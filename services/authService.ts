import { supabase } from './supabaseClient';

export const authService = {
    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async signUp(email: string, password: string, fullName: string, dni: string) {
        // 1. Crear usuario en Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName, dni: dni }
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("No se pudo crear el usuario");

        const newUserId = authData.user.id;

        // 2. Verificar si ya existe un perfil de "Personal" (creado por admin) 
        // Primero buscamos por DNI (vinculación inequívoca)
        let { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('dni', dni)
            .maybeSingle();

        // Si no se encontró por DNI, intentar por email (fallback heredado)
        if (!existingProfile) {
            const { data: emailProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', email)
                .maybeSingle();
            existingProfile = emailProfile;
        }

        if (existingProfile && existingProfile.id !== newUserId) {
            console.log(`Perfil preexistente [${existingProfile.full_name}] encontrado por ${existingProfile.dni === dni ? 'DNI' : 'Email'}. Iniciando migración...`);
            const oldId = existingProfile.id;

            try {
                // Paso 1: Liberar el email y DNI del perfil viejo temporalmente
                await supabase.from('profiles').update({ 
                    email: `${existingProfile.email}_archived_${Date.now()}`,
                    dni: `${existingProfile.dni}_archived_${Date.now()}`
                }).eq('id', oldId);

                // Paso 2: Crear nuevo perfil vinculado a Auth
                // UNIFICACIÓN: Mantenemos el nombre oficial del admin, el sector y el rol.
                // Automáticamente aprobado porque ya era un empleado cargado por admin.
                const { error: createError } = await supabase.from('profiles').insert([{
                    id: newUserId,
                    full_name: existingProfile.full_name, // Mantenemos nombre del admin
                    email: email, 
                    dni: dni,
                    role: existingProfile.role,
                    sector_id: existingProfile.sector_id,
                    managed_sectors: existingProfile.managed_sectors,
                    qr_token: existingProfile.qr_token || `SECURE_USER:${existingProfile.full_name.replace(/\s+/g, '_')}_${newUserId}`,
                    photo_url: existingProfile.photo_url,
                    is_approved: false // REQUERIR APROBACIÓN MANUAL TRAS REGISTRO DE CUENTA
                }]);

                if (createError) throw createError;

                // Paso 3: Reasignar registros de asistencia y cronogramas
                await supabase.from('attendance_records').update({ employee_id: newUserId }).eq('employee_id', oldId);
                await supabase.from('schedules').update({ employee_id: newUserId }).eq('employee_id', oldId);

                // Paso 4: Eliminar perfil viejo
                await supabase.from('profiles').delete().eq('id', oldId);

                console.log("Migración y vinculación completada.");

            } catch (migrationError) {
                console.error("Error crítico durante la migración:", migrationError);
            }
        } else if (!existingProfile) {
            // Crear perfil nuevo DESCONOCIDO -> Requiere aprobación
            const { error: createError } = await supabase.from('profiles').insert([{
                id: newUserId,
                full_name: fullName,
                email: email,
                dni: dni,
                role: 'empleado', 
                is_approved: false, // PENDIENTE DE APROBACIÓN
                qr_token: `SECURE_USER:${fullName.replace(/\s+/g, '_')}_${newUserId}`
            }]);
            if (createError) console.error("Error creando perfil inicial:", createError);
        }

        return authData;
    },

    async getSession() {
        try {
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
            const { data: { session } } = await (Promise.race([sessionPromise, timeoutPromise]) as any);
            return session;
        } catch (error) {
            console.error('Error fetching session (timeout or connection):', error);
            return null;
        }
    },

    async onAuthStateChange(callback: (event: string, session: any) => void) {
        return supabase.auth.onAuthStateChange(callback);
    },

    async getUserProfile(userId: string) {
        try {
            // Intentar buscar el perfil real con un timeout corto
            const profilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('timeout'), 2000));

            const { data: profile } = await (Promise.race([profilePromise, timeoutPromise]) as any);

            if (profile) {
                return await this.enrichProfile(profile);
            }

            // Failsafe: Si no encontramos el perfil, verificamos si es el superadmin original
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user?.email === 'isaacgomez78@gmail.com') {
                return {
                    id: userId,
                    full_name: 'Isaac Gomez (Admin)',
                    email: 'isaacgomez78@gmail.com',
                    role: 'superusuario',
                    is_suspended: false,
                    deleted_at: null,
                    roles: {
                        id: 'superusuario',
                        name: 'Modo Emergencia',
                        permissions: ['VIEW_DASHBOARD', 'MANAGE_SETTINGS', 'MANAGE_PERSONNEL', 'MANAGE_SCHEDULES', 'MANAGE_RULES', 'MANAGE_SECTORS', 'MANAGE_ROLES', 'MANAGE_USERS']
                    }
                };
            }

            // Perfil Restringido: Para usuarios que fallaron en la migración o no están aprobados
            return {
                id: userId,
                full_name: 'Usuario Pendiente',
                email: authData?.user?.email || 'Desconocido',
                role: 'empleado',
                is_approved: false,
                is_suspended: false,
                deleted_at: null,
                roles: { id: 'empleado', name: 'Pendiente', permissions: [] }
            };
        } catch (err) {
            console.error('Bypassing connectivity error:', err);
            // Fallback ante desconexión masiva
            return {
                id: userId,
                full_name: 'Usuario Restringido',
                email: 'Desconocido',
                role: 'empleado',
                is_approved: false,
                is_suspended: false,
                deleted_at: null,
                roles: { id: 'empleado', name: 'Desconectado', permissions: [] }
            };
        }
    },

    async enrichProfile(profile: any) {
        // Forzar permisos de superusuario siempre para este usuario específico
        if (profile.email === 'isaacgomez78@gmail.com') {
            profile.role = 'superusuario';
            profile.is_suspended = false;
            profile.deleted_at = null;
            profile.roles = {
                id: 'superusuario',
                name: 'Superusuario',
                permissions: ['VIEW_DASHBOARD', 'MANAGE_SETTINGS', 'MANAGE_PERSONNEL', 'MANAGE_SCHEDULES', 'MANAGE_RULES', 'MANAGE_SECTORS', 'MANAGE_ROLES', 'MANAGE_USERS']
            };
            return profile;
        }

        // Logic for checking effective suspension
        if (profile.is_suspended) {
            if (profile.suspended_until) {
                const isStillSuspended = new Date(profile.suspended_until) > new Date();
                if (!isStillSuspended) {
                    // Auto-lift in-memory (DB will be updated when an admin views the user list or next login)
                    profile.is_suspended = false;
                }
            }
        }

        try {
            const rolePromise = supabase.from('roles').select('*').eq('id', profile.role).single();
            const permsPromise = supabase.from('role_permissions').select('permission_id').eq('role_id', profile.role);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));

            const [roleRes, permsRes] = await (Promise.allSettled([
                Promise.race([rolePromise, timeoutPromise]),
                Promise.race([permsPromise, timeoutPromise])
            ]) as any);
            
            const roleData = roleRes.status === 'fulfilled' ? roleRes.value.data : null;
            const permsData = permsRes.status === 'fulfilled' ? permsRes.value.data : null;

            profile.roles = {
                ...(roleData || { id: profile.role, name: profile.role }),
                permissions: permsData ? permsData.map((p: any) => p.permission_id) : []
            };
        } catch (e) { 
            console.warn('Error enriching profile (using basic role):', e);
            profile.roles = { id: profile.role, name: profile.role, permissions: [] };
        }
        return profile;
    }
};

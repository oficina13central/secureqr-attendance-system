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

    async signUp(email: string, password: string, fullName: string) {
        // 1. Crear usuario en Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName }
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("No se pudo crear el usuario");

        const newUserId = authData.user.id;

        // 2. Verificar si ya existe un perfil de "Personal" (creado por admin) con este email
        // que no esté vinculado (es decir, que tenga un ID diferente al de Auth, lo cual pasará siempre si fue creado manualmente)
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (existingProfile && existingProfile.id !== newUserId) {
            console.log("Perfil preexistente encontrado. Iniciando migración de datos...");
            const oldId = existingProfile.id;

            // ESTRATEGIA DE MIGRACIÓN (Swap):
            // Problema: No podemos insertar el nuevo perfil con el mismo email (Unique constraint).
            // Problema: No podemos borrar el viejo perfil si tiene asistencia (FK constraint).
            // Solución: 
            // 1. Renombrar email del viejo perfil.
            // 2. Crear nuevo perfil con el ID de Auth correcto.
            // 3. Mover registros de asistencia al nuevo ID.
            // 4. Borrar viejo perfil.

            try {
                // Paso 1: Liberar el email
                await supabase.from('profiles').update({ email: `${email}_archived_${Date.now()}` }).eq('id', oldId);

                // Paso 2: Crear nuevo perfil vinculado a Auth
                const { error: createError } = await supabase.from('profiles').insert([{
                    id: newUserId,
                    full_name: existingProfile.full_name || fullName,
                    email: email, // Email real
                    role: existingProfile.role,
                    sector_id: existingProfile.sector_id,
                    qr_token: existingProfile.qr_token, // Mantener el token QR
                    photo_url: existingProfile.photo_url
                }]);

                if (createError) throw createError;

                // Paso 3: Reasignar registros de asistencia
                const { error: updateRecordsError } = await supabase
                    .from('attendance_records')
                    .update({ employee_id: newUserId })
                    .eq('employee_id', oldId);

                if (updateRecordsError) console.error("Error migrando asistencias:", updateRecordsError);

                // Paso 4: Eliminar perfil viejo (ya vacío de relaciones críticas si el paso 3 funcionó)
                await supabase.from('profiles').delete().eq('id', oldId);

                console.log("Migración completada con éxito.");

            } catch (migrationError) {
                console.error("Error crítico durante la migración de perfil:", migrationError);
                // No lanzamos error fatal para no bloquear el login, pero los datos podrían quedar desincronizados.
            }
        } else if (!existingProfile) {
            // Crear perfil nuevo si no existía ninguno
            const { error: createError } = await supabase.from('profiles').insert([{
                id: newUserId,
                full_name: fullName,
                email: email,
                role: 'empleado', // Rol por defecto
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
        // PERFIL DE EMERGENCIA INMEDIATO (Se usa si la BD falla o tarda)
        const guestProfile = {
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

        try {
            // Intentar buscar el real con un timeout corto
            const profilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('timeout'), 2000));

            const { data: profile } = await (Promise.race([profilePromise, timeoutPromise]) as any);

            if (profile) {
                return await this.enrichProfile(profile);
            }
            return guestProfile;
        } catch (err) {
            console.error('Bypassing connectivity error:', err);
            return guestProfile;
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

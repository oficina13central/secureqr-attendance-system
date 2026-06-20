import pathlib
import re
import uuid

import pandas as pd


SOURCE = pathlib.Path(r"C:\Users\DESKTOP\Downloads\lista_personas.xlsx")
DEST = pathlib.Path(__file__).with_name("importar_empleados_bar.sql")


def sql_quote(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def digits(value: str) -> str:
    return re.sub(r"\D", "", str(value or ""))


def normalize_date(value: str) -> str | None:
    value = str(value or "").strip()
    if not value:
        return None
    parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
    if pd.isna(parsed):
        return value
    return parsed.strftime("%Y-%m-%d")


df = pd.read_excel(SOURCE, sheet_name="Lista", dtype=str).fillna("")

parts: list[str] = []
parts.append("-- Ajustes necesarios para importar empleados sin cuenta de login propia\n")
parts.append("ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;\n")
parts.append("ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_type TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_position TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_category TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cuil TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marital_status TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nationality TEXT;\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS managed_sectors TEXT[] DEFAULT ARRAY[]::TEXT[];\n")
parts.append("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS compensatory_rest_balance INTEGER DEFAULT 0;\n")
parts.append("\n")
parts.append(
    "CREATE TABLE IF NOT EXISTS public.employee_documents (\n"
    "  id TEXT PRIMARY KEY,\n"
    "  employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,\n"
    "  type TEXT NOT NULL,\n"
    "  file_url TEXT NOT NULL,\n"
    "  file_name TEXT NOT NULL,\n"
    "  description TEXT NOT NULL,\n"
    "  expires_at TEXT,\n"
    "  is_required BOOLEAN DEFAULT false,\n"
    "  created_at TEXT NOT NULL\n"
    ");\n"
)
parts.append(
    "\nALTER TABLE public.employee_documents DROP CONSTRAINT IF EXISTS employee_documents_type_check;\n"
    "ALTER TABLE public.employee_documents ADD CONSTRAINT employee_documents_type_check CHECK (type IN "
    "('medical','medical_exam','epp_delivery','suspension','identity','contract','certificate','training','other'));\n"
)
parts.append(
    "\n-- Empleados importados desde lista_personas.xlsx. sector_id queda NULL para asignarlo luego en la app.\n"
)
parts.append(
    "INSERT INTO public.profiles "
    "(id, full_name, email, dni, cuil, birth_date, role, employment_type, sector_id, "
    "is_employee, is_approved, is_suspended, deleted_at, nationality, contract_type, qr_token) VALUES\n"
)

values: list[str] = []
for _, row in df.iterrows():
    employee_id = str(uuid.uuid4())
    name = " ".join(str(row.get("NOMBRE", "")).split()).title()
    dni = digits(row.get("DNI", ""))
    cuil = digits(row.get("CUIL", ""))
    birth_date = normalize_date(row.get("FECHA DE NAC.", ""))
    token_name = re.sub(r"\s+", "_", name)
    email = f"{dni or employee_id}@bar.local"
    values.append(
        "("
        f"{sql_quote(employee_id)}, "
        f"{sql_quote(name)}, "
        f"{sql_quote(email)}, "
        f"{sql_quote(dni)}, "
        f"{sql_quote(cuil) if cuil else 'NULL'}, "
        f"{sql_quote(birth_date) if birth_date else 'NULL'}, "
        "'empleado', "
        "'efectivo', "
        "NULL, "
        "true, "
        "false, "
        "false, "
        "NULL, "
        "'Argentina', "
        "'permanent', "
        f"{sql_quote('SECURE_USER:' + token_name + '_' + employee_id)}"
        ")"
    )

parts.append(",\n".join(values))
parts.append(
    "\nON CONFLICT (dni) DO UPDATE SET\n"
    "  full_name = EXCLUDED.full_name,\n"
    "  cuil = EXCLUDED.cuil,\n"
    "  birth_date = EXCLUDED.birth_date,\n"
    "  role = EXCLUDED.role,\n"
    "  employment_type = EXCLUDED.employment_type,\n"
    "  is_employee = true,\n"
    "  deleted_at = NULL;\n"
)

DEST.write_text("".join(parts), encoding="utf-8")
print(f"Generated {DEST} with {len(df)} employees")

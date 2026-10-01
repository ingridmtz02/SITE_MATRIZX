import csv
import io
import random
from datetime import date, datetime
from fastapi import FastAPI, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict

app = FastAPI(
    title="MatriZX API",
    description="Backend para la evaluación y catálogo público de Maternidad Segura"
)

# Permitir peticiones desde el frontend HTML/JS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción se restringe al dominio exacto
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DATOS ---
class SolicitudHospital(BaseModel):
    nombre_contacto: str
    cargo: str
    hospital: str
    correo: EmailStr
    nacimientos_anuales: int

class CredencialesLogin(BaseModel):
    correo: EmailStr
    password: str

class RespuestaAutoevaluacion(BaseModel):
    criterio_id: str
    escalon_estimado: int
    evidencia_nombre: Optional[str] = None

class AutoevaluacionPayload(BaseModel):
    respuestas: List[RespuestaAutoevaluacion]

class AvanceAreaMejora(BaseModel):
    avance_registrado: str

# --- BASE DE DATOS SIMULADA (Sustituir por tus funciones/modelos de Python) ---
HOSPITALES_DB = [
    {
        "id": "hosp-1",
        "nombre": "Hospital de la Mujer Jalisco",
        "ciudad": "Guadalajara",
        "estado": "Jalisco",
        "nivel": "nivel3",
        "nivelNombre": "Nivel 3 — Referente",
        "icono": "🏆",
        "claseBadge": "badge-nivel3",
        "vigencia": "Agosto 2027"
    },
    {
        "id": "hosp-2",
        "nombre": "Clínica Materna del Sol",
        "ciudad": "Zapopan",
        "estado": "Jalisco",
        "nivel": "nivel2",
        "nivelNombre": "Nivel 2 — Consolidado",
        "icono": "⭐",
        "claseBadge": "badge-nivel2",
        "vigencia": "Diciembre 2026"
    },
    {
        "id": "hosp-3",
        "nombre": "Hospital San Rafael",
        "ciudad": "Ciudad de México",
        "estado": "CDMX",
        "nivel": "nivel1",
        "nivelNombre": "Nivel 1 — Comprometido",
        "icono": "🛡️",
        "claseBadge": "badge-nivel1",
        "vigencia": "Octubre 2026"
    }
]

# --- ENDPOINTS REST ---

@app.get("/api/v1/hospitales")
def obtener_catalogo_publico(estado: Optional[str] = None, nivel: Optional[str] = None):
    """
    Regla de Transparencia Asimétrica: Solo retorna datos públicos (nombre, ciudad, nivel, vigencia).
    """
    resultados = HOSPITALES_DB
    
    if estado and estado != "todos":
        resultados = [h for h in resultados if h["estado"].lower() == estado.lower()]
    
    if nivel and nivel != "todos":
        resultados = [h for h in resultados if h["nivel"] == nivel]
        
    return resultados

@app.post("/api/v1/solicitud-registro", status_code=status.HTTP_201_CREATED)
def registrar_solicitud_hospital(solicitud: SolicitudHospital):
    """
    Recibe la solicitud enviada desde el formulario web con el stepper numérico.
    """
    # Aquí ejecutas tus funciones de procesamiento en Python
    # ej: procesar_diagnostico_inicial(solicitud.nacimientos_anuales)
    return {
        "status": "success",
        "mensaje": f"Solicitud recibida correctamente para {solicitud.hospital}",
        "id_registro": "SOL-9982"
    }

@app.post("/api/v1/auth/login")
def login_unificado(credenciales: CredencialesLogin):
    """
    Enrutamiento según el rol que retorne tu lógica de autenticación en Python.
    """
    # Lógica simulada de validación
    if credenciales.correo.startswith("admin"):
        rol = "admin"
    elif credenciales.correo.startswith("auditora"):
        rol = "auditora"
    else:
        rol = "hospital"
        
    return {
        "token": "bearer_token_simulado_xyz",
        "rol": rol,
        "usuario": credenciales.correo
    }
# ==============================================================================
# PORTAL DEL HOSPITAL (Superficie 2)
# NOTA: En esta versión no hay sesiones reales; todo el portal opera sobre un
# único hospital simulado (HOSPITAL_ACTUAL). Cuando exista autenticación real,
# sustituir por el hospital resuelto a partir del token del header Authorization.
# ==============================================================================

HOSPITAL_ACTUAL = HOSPITALES_DB[2]  # Hospital San Rafael, Nivel 1

random.seed(42)  # datos simulados pero reproducibles entre reinicios del server

# --- 1. INICIO (RESUMEN) ---

@app.get("/api/v1/portal/resumen")
def portal_resumen():
    hoy = date.today()
    vigencia = date(2026, 10, 31)
    dias_restantes = (vigencia - hoy).days
    return {
        "hospital": HOSPITAL_ACTUAL["nombre"],
        "sello": {
            "nivel": HOSPITAL_ACTUAL["nivel"],
            "nivelNombre": HOSPITAL_ACTUAL["nivelNombre"],
            "vigencia": vigencia.isoformat(),
            "dias_restantes": dias_restantes
        },
        "proximo_hito": {
            "tipo": "Entrega anual SINAC + cuestionario estructural",
            "fecha": "2026-11-30"
        },
        "alertas": [
            {
                "id": "al-1",
                "tipo": "fuera_de_rango",
                "mensaje": "La tasa de cesárea del Grupo 1 de Robson está por encima de la banda GPC",
                "seccion": "tablero"
            },
            {
                "id": "al-2",
                "tipo": "plazo",
                "mensaje": "1 línea roja pendiente de subsanar antes de la re-verificación",
                "seccion": "verificacion"
            }
        ],
        "novedades": [
            {"fecha": "2026-09-01", "mensaje": "Se publicó la versión 0.2 del Estándar de líneas rojas"},
            {"fecha": "2026-08-15", "mensaje": "Nuevo criterio de captura SINAC en el motor de calidad de datos"}
        ]
    }

# --- 2. MI TABLERO (MATRIZX) ---

GRUPOS_ROBSON = [
    {"grupo": 1, "descripcion": "Nulípara, única, cefálico, ≥37 sem, trabajo de parto espontáneo"},
    {"grupo": 2, "descripcion": "Nulípara, única, cefálico, ≥37 sem, inducido o cesárea antes de TP"},
    {"grupo": 3, "descripcion": "Multípara sin cesárea previa, única, cefálico, ≥37 sem, espontáneo"},
    {"grupo": 4, "descripcion": "Multípara sin cesárea previa, única, cefálico, ≥37 sem, inducido/cesárea antes de TP"},
    {"grupo": 5, "descripcion": "Multípara con ≥1 cesárea previa, única, cefálico, ≥37 sem"},
    {"grupo": 6, "descripcion": "Nulípara, pélvico"},
    {"grupo": 7, "descripcion": "Multípara, pélvico (incluye cesárea previa)"},
    {"grupo": 8, "descripcion": "Embarazo múltiple (incluye cesárea previa)"},
    {"grupo": 9, "descripcion": "Situación transversa u oblicua (incluye cesárea previa)"},
    {"grupo": 10, "descripcion": "Única, cefálico, prematuro <37 sem (incluye cesárea previa)"},
]

def _generar_robson():
    filas = []
    for g in GRUPOS_ROBSON:
        n = random.randint(8, 260)
        tasa = round(random.uniform(5, 65), 1)
        contribucion = round((n / 1200) * 100, 1)
        filas.append({
            "grupo": g["grupo"],
            "descripcion": g["descripcion"],
            "tasa_cesarea": tasa,
            "contribucion_total": contribucion,
            "denominador": n,
            "banda_gpc": [10, 20] if g["grupo"] in (1, 3) else [20, 45]
        })
    return filas

def _generar_reloj_nacimiento():
    dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    matriz_parto = [[random.randint(0, 12) for _ in range(24)] for _ in dias]
    matriz_cesarea = [[random.randint(0, 8) for _ in range(24)] for _ in dias]
    # Las cesáreas programadas se concentran en horario matutino entre semana
    for d in range(5):
        for h in range(7, 14):
            matriz_cesarea[d][h] += random.randint(4, 10)
    return {"dias": dias, "parto": matriz_parto, "cesarea": matriz_cesarea}

def _generar_tendencia_mensual(periodo: str):
    n_meses = 6 if periodo == "6m" else 12
    meses = [f"{m:02d}/2026" for m in range(max(1, 9 - n_meses + 1), 9)][-n_meses:]
    partos = [random.randint(60, 100) for _ in meses]
    cesareas = [random.randint(30, 60) for _ in meses]
    return {"meses": meses, "parto": partos, "cesarea": cesareas}

def _generar_indicadores_neonatales(periodo: str):
    n_meses = 6 if periodo == "6m" else 12
    meses = [f"{m:02d}/2026" for m in range(max(1, 9 - n_meses + 1), 9)][-n_meses:]
    return {
        "meses": meses,
        "apgar_bajo": {"valores": [round(random.uniform(0.3, 2.2), 2) for _ in meses], "referencia_gpc": 1.0, "denominador_promedio": 82},
        "prematurez": {"valores": [round(random.uniform(5, 12), 1) for _ in meses], "referencia_gpc": 8.0, "denominador_promedio": 82},
        "programados_37_38": {"valores": [round(random.uniform(2, 9), 1) for _ in meses], "referencia_gpc": 5.0, "denominador_promedio": 82}
    }

N_HOSPITALES_CARTERA = 3  # < 5 -> el percentil de cartera se oculta

@app.get("/api/v1/portal/tablero")
def portal_tablero(periodo: str = "12m"):
    return {
        "periodo": periodo,
        "robson": _generar_robson(),
        "tendencia_mensual": _generar_tendencia_mensual(periodo),
        "reloj_nacimiento": _generar_reloj_nacimiento(),
        "indicadores_neonatales": _generar_indicadores_neonatales(periodo),
        "comparativas": {
            "mi_hospital_cesarea_global": 34.2,
            "mi_hospital_n": 1180,
            "promedio_estatal_privado_sinac": 38.5,
            "percentil_cartera_matriz": None,
            "n_hospitales_cartera": N_HOSPITALES_CARTERA,
            "cartera_visible": N_HOSPITALES_CARTERA >= 5
        },
        "calidad_captura_sinac": {
            "pct_registros_limpios": 91.7,
            "total_registros": 1180,
            "top_errores": [
                {"campo": "peso_recien_nacido", "pct": 3.1, "n": 37},
                {"campo": "edad_gestacional_capurro", "pct": 2.4, "n": 28},
                {"campo": "hora_nacimiento", "pct": 1.8, "n": 21},
                {"campo": "via_de_nacimiento", "pct": 1.0, "n": 12}
            ]
        }
    }

# --- 3. MI VERIFICACIÓN ---

DOMINIOS_VERIFICACION = [
    {"id": "dom-1", "nombre": "Gobernanza y liderazgo en calidad", "puntaje": 78, "umbral": 70},
    {"id": "dom-2", "nombre": "Talento humano y competencias", "puntaje": 64, "umbral": 70},
    {"id": "dom-3", "nombre": "Infraestructura y equipamiento", "puntaje": 82, "umbral": 70},
    {"id": "dom-4", "nombre": "Procesos clínicos y seguridad del paciente", "puntaje": 71, "umbral": 70},
    {"id": "dom-5", "nombre": "Trabajo de parto y parto respetado", "puntaje": 58, "umbral": 70},
    {"id": "dom-6", "nombre": "Manejo de emergencias obstétricas", "puntaje": 88, "umbral": 70},
    {"id": "dom-7", "nombre": "Mejora continua y uso de datos", "puntaje": 69, "umbral": 70},
]

def _semaforo(puntaje: int, umbral: int) -> str:
    if puntaje >= umbral + 10:
        return "verde"
    if puntaje >= umbral:
        return "amarillo"
    return "rojo"

LINEAS_ROJAS_VERIFICACION = [
    {"id": "lr-1", "texto": "Partograma integrado en expediente de trabajo de parto", "cumple": True},
    {"id": "lr-2", "texto": "Acompañamiento continuo por la persona elegida", "cumple": True},
    {"id": "lr-3", "texto": "Contacto piel a piel y lactancia en los primeros 30 min", "cumple": True},
    {"id": "lr-4", "texto": "Triage obstétrico y Código Mater implementados", "cumple": True},
    {"id": "lr-5", "texto": "Comité de morbimortalidad activo con actas", "cumple": False},
    {"id": "lr-6", "texto": "No restricción injustificada del movimiento", "cumple": True},
    {"id": "lr-7", "texto": "No exposición: privacidad efectiva durante el proceso", "cumple": True},
]

DETALLE_DOMINIOS = {
    "dom-1": [
        {"criterio": "Existe comité de calidad con reuniones documentadas", "escalon_alcanzado": 3, "hallazgo": "El comité sesiona bimestralmente; faltan actas de dos sesiones de 2026."},
        {"criterio": "La dirección revisa indicadores de forma periódica", "escalon_alcanzado": 3, "hallazgo": "Revisión mensual confirmada con bitácora de acuerdos."},
    ],
    "dom-2": [
        {"criterio": "Guardia de ginecología 24/7 con médico de base", "escalon_alcanzado": 2, "hallazgo": "Cobertura nocturna depende de médico de guardia externo."},
        {"criterio": "Capacitación anual en emergencias obstétricas", "escalon_alcanzado": 2, "hallazgo": "Última capacitación registrada hace 14 meses."},
    ],
    "dom-3": [
        {"criterio": "Quirófano obstétrico disponible en menos de 15 min", "escalon_alcanzado": 4, "hallazgo": "Tiempo promedio verificado de 9 minutos en ambos turnos."},
    ],
    "dom-4": [
        {"criterio": "Protocolo de hemorragia obstétrica con simulacros", "escalon_alcanzado": 3, "hallazgo": "Protocolo vigente; simulacro más reciente hace 5 meses."},
    ],
    "dom-5": [
        {"criterio": "Libertad de posición y movimiento durante el trabajo de parto", "escalon_alcanzado": 2, "hallazgo": "Entrevistas a usuarias reportan restricción frecuente por monitoreo continuo."},
        {"criterio": "Entrevista a la mujer sin personal presente", "escalon_alcanzado": 2, "hallazgo": "Se realizó en un turno de los dos verificados."},
    ],
    "dom-6": [
        {"criterio": "Código Mater activable por cualquier miembro del equipo", "escalon_alcanzado": 4, "hallazgo": "Verificado en piso con simulacro sorpresa exitoso."},
    ],
    "dom-7": [
        {"criterio": "Uso de datos SINAC para decisiones clínicas", "escalon_alcanzado": 3, "hallazgo": "Existe tablero interno; falta evidencia de acciones derivadas."},
    ],
}

AREAS_MEJORA_DB = [
    {"id": "am-1", "titulo": "Formalizar actas del comité de morbimortalidad", "impacto": "alto", "esfuerzo": "bajo", "criterio_origen": "dom-1 · Existe comité de calidad con reuniones documentadas", "ancla_normativa": "NOM-007-SSA2-2016, num. 5.13", "avance_registrado": ""},
    {"id": "am-2", "titulo": "Cerrar brecha de libertad de movimiento en trabajo de parto", "impacto": "alto", "esfuerzo": "medio", "criterio_origen": "dom-5 · Libertad de posición y movimiento", "ancla_normativa": "NOM-007-SSA2-2016, num. 5.4.3", "avance_registrado": "Se capacitó a enfermería de un turno; falta turno nocturno."},
    {"id": "am-3", "titulo": "Actualizar capacitación anual en emergencias obstétricas", "impacto": "medio", "esfuerzo": "bajo", "criterio_origen": "dom-2 · Capacitación anual en emergencias obstétricas", "ancla_normativa": "Lineamiento Código Mater, SSA 2018", "avance_registrado": ""},
    {"id": "am-4", "titulo": "Consolidar guardia de ginecología con médico de base", "impacto": "alto", "esfuerzo": "alto", "criterio_origen": "dom-2 · Guardia de ginecología 24/7", "ancla_normativa": "NOM-007-SSA2-2016, num. 5.2", "avance_registrado": ""},
]

HISTORIAL_VERIFICACION = [
    {"fecha": "2026-08-20", "nivel_resultante": "nivel1", "puntaje_global": 72},
    {"fecha": "2025-08-18", "nivel_resultante": "nivel1", "puntaje_global": 65},
]

@app.get("/api/v1/portal/verificacion")
def portal_verificacion():
    dominios = [{**d, "semaforo": _semaforo(d["puntaje"], d["umbral"])} for d in DOMINIOS_VERIFICACION]
    return {
        "dominios": dominios,
        "lineas_rojas": LINEAS_ROJAS_VERIFICACION,
        "detalle_dominios": DETALLE_DOMINIOS,
        "areas_mejora": AREAS_MEJORA_DB,
        "historial": HISTORIAL_VERIFICACION
    }

@app.patch("/api/v1/portal/areas-mejora/{area_id}")
def actualizar_avance_area_mejora(area_id: str, avance: AvanceAreaMejora):
    for area in AREAS_MEJORA_DB:
        if area["id"] == area_id:
            area["avance_registrado"] = avance.avance_registrado
            return {"status": "success", "area": area}
    raise HTTPException(status_code=404, detail="Área de mejora no encontrada")

# --- 4. MI SELLO ---

@app.get("/api/v1/portal/sello")
def portal_sello():
    return {
        "nivel_vigente": HOSPITAL_ACTUAL["nivel"],
        "nivelNombre": HOSPITAL_ACTUAL["nivelNombre"],
        "vigencia": HOSPITAL_ACTUAL["vigencia"],
        "estado": "vigente",
        "detalle_estado": None,
        "kit": [
            {"nombre": "Logo del sello (SVG)", "url": "/api/v1/portal/sello/kit/logo.svg"},
            {"nombre": "Placa imprimible (SVG)", "url": "/api/v1/portal/sello/kit/placa.svg"},
            {"nombre": "Manual de uso (1 página)", "url": "/api/v1/portal/sello/kit/manual.txt"},
        ],
        "ficha_publica_url": f"/#catalogo?hospital={HOSPITAL_ACTUAL['id']}"
    }

_COLOR_NIVEL = {"nivel1": "#2A9D8F", "nivel2": "#0077B6", "nivel3": "#FFB703"}
_ICONO_NIVEL = {"nivel1": "🛡️", "nivel2": "⭐", "nivel3": "🏆"}

@app.get("/api/v1/portal/sello/kit/logo.svg")
def descargar_logo_svg():
    color = _COLOR_NIVEL[HOSPITAL_ACTUAL["nivel"]]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">
  <circle cx="120" cy="120" r="112" fill="#FFFFFF" stroke="{color}" stroke-width="10"/>
  <text x="120" y="105" font-family="Arial" font-size="40" text-anchor="middle" fill="{color}">MatriZ</text>
  <text x="120" y="150" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle" fill="#0A2540">{HOSPITAL_ACTUAL["nivelNombre"]}</text>
  <text x="120" y="180" font-family="Arial" font-size="14" text-anchor="middle" fill="#495057">Vigente hasta {HOSPITAL_ACTUAL["vigencia"]}</text>
</svg>'''
    return Response(content=svg, media_type="image/svg+xml")

@app.get("/api/v1/portal/sello/kit/placa.svg")
def descargar_placa_svg():
    color = _COLOR_NIVEL[HOSPITAL_ACTUAL["nivel"]]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300">
  <rect x="0" y="0" width="600" height="300" fill="#0A2540"/>
  <rect x="20" y="20" width="560" height="260" fill="none" stroke="{color}" stroke-width="4"/>
  <text x="300" y="90" font-family="Arial" font-size="30" text-anchor="middle" fill="#FFFFFF">Sello Maternidad Segura y Respetada</text>
  <text x="300" y="150" font-family="Arial" font-size="26" font-weight="bold" text-anchor="middle" fill="{color}">{HOSPITAL_ACTUAL["nivelNombre"]}</text>
  <text x="300" y="190" font-family="Arial" font-size="20" text-anchor="middle" fill="#FFFFFF">{HOSPITAL_ACTUAL["nombre"]}</text>
  <text x="300" y="230" font-family="Arial" font-size="16" text-anchor="middle" fill="#CED4DA">Vigente hasta {HOSPITAL_ACTUAL["vigencia"]}</text>
</svg>'''
    return Response(content=svg, media_type="image/svg+xml")

@app.get("/api/v1/portal/sello/kit/manual.txt", response_class=PlainTextResponse)
def descargar_manual_uso():
    return f"""MANUAL DE USO DEL SELLO — {HOSPITAL_ACTUAL["nivelNombre"].upper()}
{HOSPITAL_ACTUAL["nombre"]}

1. Dónde usarlo: en el acceso principal del hospital, en el área de admisión
   materna y en materiales impresos dirigidos a las pacientes (trípticos,
   señalética). No usarlo en publicidad de servicios no evaluados por MatriZ.

2. Cómo usarlo: siempre a color, sin recortar, deformar ni combinarlo con
   otros logotipos en el mismo espacio visual. Tamaño mínimo: 3 cm de ancho.

3. Vigencia: este sello es válido únicamente hasta {HOSPITAL_ACTUAL["vigencia"]}.
   Al vencer, debe retirarse de toda señalética y material impreso hasta
   contar con la re-verificación correspondiente.

4. Nivel obtenido: {HOSPITAL_ACTUAL["nivelNombre"]}. El nivel no es
   transferible entre sedes ni unidades distintas a la evaluada.

5. Dudas o mal uso reportado: contacto@matriz.org
"""

# --- 5. PRE-AUDITORÍA (AUTOEVALUACIÓN GUIADA) ---

ESTANDAR_PREAUDITORIA = [
    {
        "dominio_id": "dom-1", "dominio_nombre": "Gobernanza y liderazgo en calidad",
        "criterios": [
            {"id": "pa-1-1", "texto": "Existe comité de calidad con reuniones documentadas",
             "escalones": ["No existe comité formal", "Existe pero sin actas", "Sesiona regularmente con actas parciales", "Sesiona regularmente con actas completas y acuerdos de seguimiento"]},
            {"id": "pa-1-2", "texto": "La dirección revisa indicadores de forma periódica",
             "escalones": ["Sin revisión formal", "Revisión anual", "Revisión trimestral", "Revisión mensual con acciones documentadas"]},
        ]
    },
    {
        "dominio_id": "dom-4", "dominio_nombre": "Procesos clínicos y seguridad del paciente",
        "criterios": [
            {"id": "pa-4-1", "texto": "Protocolo de hemorragia obstétrica con simulacros",
             "escalones": ["Sin protocolo", "Protocolo sin simulacros", "Protocolo con simulacro anual", "Protocolo con simulacros semestrales y retroalimentación"]},
        ]
    },
    {
        "dominio_id": "dom-5", "dominio_nombre": "Trabajo de parto y parto respetado",
        "criterios": [
            {"id": "pa-5-1", "texto": "Libertad de posición y movimiento durante el trabajo de parto",
             "escalones": ["Restricción sistemática", "Restricción frecuente por monitoreo", "Libertad en la mayoría de los casos", "Libertad garantizada salvo contraindicación médica documentada"]},
        ]
    },
]

AUTOEVALUACIONES_DB: Dict[str, dict] = {}

@app.get("/api/v1/portal/preauditoria")
def portal_preauditoria():
    return {"estandar": ESTANDAR_PREAUDITORIA, "ultima_autoevaluacion": AUTOEVALUACIONES_DB.get(HOSPITAL_ACTUAL["id"])}

@app.post("/api/v1/portal/preauditoria/autoevaluacion")
def guardar_autoevaluacion(payload: AutoevaluacionPayload):
    criterio_a_dominio = {}
    for bloque in ESTANDAR_PREAUDITORIA:
        for c in bloque["criterios"]:
            criterio_a_dominio[c["id"]] = bloque["dominio_nombre"]

    acumulado: Dict[str, List[int]] = {}
    for r in payload.respuestas:
        dominio = criterio_a_dominio.get(r.criterio_id, "Sin clasificar")
        acumulado.setdefault(dominio, []).append(r.escalon_estimado)

    brecha_por_dominio = []
    for dominio, escalones in acumulado.items():
        promedio = sum(escalones) / len(escalones)
        brecha_pct = round((1 - (promedio / 4)) * 100, 1)
        brecha_por_dominio.append({"dominio": dominio, "escalon_promedio": round(promedio, 1), "brecha_pct": brecha_pct})

    resultado = {
        "fecha": date.today().isoformat(),
        "brecha_por_dominio": brecha_por_dominio,
        "etiqueta": "estimación propia, no dictamen"
    }
    AUTOEVALUACIONES_DB[HOSPITAL_ACTUAL["id"]] = resultado
    return resultado

# --- 6. MIS DATOS (CARGA SINAC + CUESTIONARIO ESTRUCTURAL) ---

COLUMNAS_REQUERIDAS_SINAC = [
    "fecha_nacimiento", "via_de_nacimiento", "edad_gestacional_capurro",
    "peso_recien_nacido", "apgar_5min", "hora_nacimiento"
]

SINAC_HISTORIAL: List[dict] = [
    {"id": "carga-1", "fecha": "2026-01-15", "archivo": "sinac_2025_anual.csv", "pct_limpios": 88.4, "total_registros": 1120},
]

@app.post("/api/v1/portal/sinac/cargar")
async def cargar_sinac(archivo: UploadFile = File(...)):
    if not archivo.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos .csv exportados de SINAC")

    contenido = (await archivo.read()).decode("utf-8-sig", errors="replace")
    lector = csv.DictReader(io.StringIO(contenido))
    columnas_presentes = lector.fieldnames or []

    columnas_faltantes = [c for c in COLUMNAS_REQUERIDAS_SINAC if c not in columnas_presentes]
    if columnas_faltantes:
        raise HTTPException(
            status_code=422,
            detail=f"Faltan columnas requeridas en el CSV: {', '.join(columnas_faltantes)}"
        )

    filas = list(lector)
    total = len(filas)
    if total == 0:
        raise HTTPException(status_code=422, detail="El archivo no contiene registros")

    conteo_errores: Dict[str, int] = {c: 0 for c in COLUMNAS_REQUERIDAS_SINAC}
    filas_limpias = 0
    for fila in filas:
        errores_fila = [c for c in COLUMNAS_REQUERIDAS_SINAC if not fila.get(c, "").strip()]
        if errores_fila:
            for c in errores_fila:
                conteo_errores[c] += 1
        else:
            filas_limpias += 1

    pct_limpios = round((filas_limpias / total) * 100, 1)
    top_errores = sorted(
        [{"campo": c, "n": n, "pct": round((n / total) * 100, 1)} for c, n in conteo_errores.items() if n > 0],
        key=lambda x: -x["n"]
    )

    registro = {
        "id": f"carga-{len(SINAC_HISTORIAL) + 1}",
        "fecha": date.today().isoformat(),
        "archivo": archivo.filename,
        "pct_limpios": pct_limpios,
        "total_registros": total
    }
    SINAC_HISTORIAL.append(registro)

    return {
        "registro": registro,
        "reporte_calidad": {
            "total_registros": total,
            "registros_limpios": filas_limpias,
            "pct_limpios": pct_limpios,
            "top_errores": top_errores
        }
    }

@app.get("/api/v1/portal/sinac/historial")
def historial_sinac():
    return SINAC_HISTORIAL

CAMPOS_CUESTIONARIO_ESTRUCTURAL = [
    {"categoria": "Identificación", "campos": [
        {"id": "nombre_responsable", "etiqueta": "Nombre de quien responde", "tipo": "texto"},
        {"id": "cargo_responsable", "etiqueta": "Cargo", "tipo": "texto"},
        {"id": "fecha_ultima_actualizacion", "etiqueta": "Fecha de última actualización de estos datos", "tipo": "fecha"},
    ]},
    {"categoria": "Infraestructura", "campos": [
        {"id": "num_camas_toco", "etiqueta": "Número de camas en tococirugía", "tipo": "numero"},
        {"id": "num_quirofanos_obstetricos", "etiqueta": "Número de quirófanos obstétricos", "tipo": "numero"},
        {"id": "num_camas_neonatologia", "etiqueta": "Número de camas de neonatología", "tipo": "numero"},
        {"id": "cuenta_uci_neonatal", "etiqueta": "¿Cuenta con UCI neonatal propia?", "tipo": "booleano"},
        {"id": "cuenta_banco_sangre", "etiqueta": "¿Cuenta con banco de sangre o convenio de respuesta inmediata?", "tipo": "booleano"},
        {"id": "cuenta_area_triage_obstetrico", "etiqueta": "¿Cuenta con área dedicada de triage obstétrico?", "tipo": "booleano"},
    ]},
    {"categoria": "Personal", "campos": [
        {"id": "num_ginecologos", "etiqueta": "Número de ginecoobstetras de base", "tipo": "numero"},
        {"id": "num_pediatras_neonatologos", "etiqueta": "Número de pediatras o neonatólogos de base", "tipo": "numero"},
        {"id": "num_enfermeras_obstetricas", "etiqueta": "Número de enfermeras obstétricas o perinatales", "tipo": "numero"},
        {"id": "guardia_24_7_ginecologia", "etiqueta": "¿Guardia de ginecología 24/7 con médico de base?", "tipo": "booleano"},
        {"id": "guardia_24_7_anestesiologia", "etiqueta": "¿Guardia de anestesiología 24/7?", "tipo": "booleano"},
        {"id": "guardia_24_7_pediatria", "etiqueta": "¿Guardia de pediatría 24/7?", "tipo": "booleano"},
    ]},
    {"categoria": "Procesos", "campos": [
        {"id": "cuenta_codigo_mater", "etiqueta": "¿Código Mater implementado?", "tipo": "booleano"},
        {"id": "cuenta_partograma_digital", "etiqueta": "¿Partograma integrado en expediente electrónico?", "tipo": "booleano"},
        {"id": "cuenta_comite_morbimortalidad", "etiqueta": "¿Comité de morbimortalidad activo?", "tipo": "booleano"},
        {"id": "frecuencia_comite", "etiqueta": "Frecuencia de sesiones del comité", "tipo": "texto"},
        {"id": "protocolo_hemorragia_obstetrica", "etiqueta": "¿Protocolo de hemorragia obstétrica vigente?", "tipo": "booleano"},
        {"id": "protocolo_preeclampsia", "etiqueta": "¿Protocolo de preeclampsia/eclampsia vigente?", "tipo": "booleano"},
    ]},
    {"categoria": "Datos y mejora continua", "campos": [
        {"id": "sistema_expediente_electronico", "etiqueta": "¿Cuenta con expediente clínico electrónico?", "tipo": "booleano"},
        {"id": "envia_sinac_mensual", "etiqueta": "¿Envía SINAC de forma mensual (no solo anual)?", "tipo": "booleano"},
        {"id": "responsable_calidad_dedicado", "etiqueta": "¿Hay una persona dedicada a calidad/epidemiología?", "tipo": "booleano"},
        {"id": "capacitacion_anual_personal", "etiqueta": "¿Capacitación anual documentada para el personal?", "tipo": "booleano"},
    ]},
]

CUESTIONARIO_ESTRUCTURAL_DB: Dict[str, dict] = {}

def _total_campos_cuestionario() -> int:
    return sum(len(bloque["campos"]) for bloque in CAMPOS_CUESTIONARIO_ESTRUCTURAL)

@app.get("/api/v1/portal/cuestionario-estructural")
def obtener_cuestionario_estructural():
    respuestas = CUESTIONARIO_ESTRUCTURAL_DB.get(HOSPITAL_ACTUAL["id"], {})
    total = _total_campos_cuestionario()
    completados = sum(1 for v in respuestas.values() if v not in (None, ""))
    return {
        "definicion": CAMPOS_CUESTIONARIO_ESTRUCTURAL,
        "respuestas": respuestas,
        "pct_completado": round((completados / total) * 100, 1) if total else 0
    }

@app.post("/api/v1/portal/cuestionario-estructural")
def guardar_cuestionario_estructural(respuestas: Dict[str, str]):
    actual = CUESTIONARIO_ESTRUCTURAL_DB.setdefault(HOSPITAL_ACTUAL["id"], {})
    actual.update(respuestas)
    total = _total_campos_cuestionario()
    completados = sum(1 for v in actual.values() if v not in (None, ""))
    return {
        "status": "success",
        "pct_completado": round((completados / total) * 100, 1) if total else 0,
        "respuestas": actual
    }

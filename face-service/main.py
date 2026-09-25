import io
import os
import time

import face_recognition
import numpy as np
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
UMBRAL_COINCIDENCIA = float(os.environ.get("UMBRAL_COINCIDENCIA", "0.55"))
BUCKET_FOTOS = "fotos-empleados"
LADO_MAXIMO_PX = 800
TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024

app = FastAPI(title="Servicio de verificacion facial")
db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def empleado_autenticado(authorization: str = Header(default="")) -> str:
    """Valida el JWT de Supabase y devuelve el id del empleado dueno de la sesion."""
    esquema, _, token = authorization.partition(" ")
    if esquema.lower() != "bearer" or not token:
        raise HTTPException(401, "Falta la sesion (header Authorization: Bearer <token>).")

    try:
        usuario = db.auth.get_user(token).user
    except Exception:
        usuario = None
    if usuario is None:
        raise HTTPException(401, "Sesion invalida o expirada.")

    respuesta = (
        db.table("empleados")
        .select("id")
        .eq("auth_user_id", usuario.id)
        .eq("activo", True)
        .limit(1)
        .execute()
    )
    if not respuesta.data:
        raise HTTPException(403, "Esta cuenta no corresponde a un empleado activo.")

    return respuesta.data[0]["id"]


def preparar_imagen(foto_bytes: bytes) -> Image.Image:
    """Abre la foto, corrige la orientacion EXIF y la reduce para acelerar el analisis."""
    if len(foto_bytes) > TAMANO_MAXIMO_BYTES:
        raise HTTPException(413, "La foto es demasiado pesada (maximo 10 MB).")

    try:
        imagen = Image.open(io.BytesIO(foto_bytes))
        imagen = ImageOps.exif_transpose(imagen).convert("RGB")
    except Exception:
        raise HTTPException(422, "El archivo no es una imagen valida.")

    imagen.thumbnail((LADO_MAXIMO_PX, LADO_MAXIMO_PX))
    return imagen


def obtener_descriptor(imagen: Image.Image) -> list[float]:
    rostros = face_recognition.face_encodings(np.array(imagen))

    if len(rostros) == 0:
        raise HTTPException(422, "No se detecto ningun rostro en la foto.")
    if len(rostros) > 1:
        raise HTTPException(422, "Se detecto mas de un rostro; toma la foto tu solo, de frente.")

    return rostros[0].tolist()


def subir_foto(empleado_id: str, imagen: Image.Image, subcarpeta: str) -> str:
    buffer = io.BytesIO()
    imagen.save(buffer, format="JPEG", quality=85)

    ruta = f"{subcarpeta}/{empleado_id}-{int(time.time())}.jpg"
    db.storage.from_(BUCKET_FOTOS).upload(
        ruta, buffer.getvalue(), {"content-type": "image/jpeg"}
    )
    return ruta


# Los endpoints son `def` (no `async def`) a proposito: el analisis facial y las
# llamadas a Supabase son sincronos y FastAPI los ejecuta en un threadpool,
# asi un analisis lento no bloquea las demas peticiones.


@app.get("/salud")
def salud():
    return {"estado": "ok"}


@app.post("/registrar-rostro")
def registrar_rostro(
    foto: UploadFile = File(...),
    empleado_id: str = Depends(empleado_autenticado),
):
    ya_registrado = (
        db.table("empleados")
        .select("rostro_registrado")
        .eq("id", empleado_id)
        .single()
        .execute()
    )
    if ya_registrado.data["rostro_registrado"]:
        raise HTTPException(
            409, "Ya hay un rostro registrado; pide a un administrador que lo restablezca."
        )

    imagen = preparar_imagen(foto.file.read())
    descriptor = obtener_descriptor(imagen)
    ruta_foto = subir_foto(empleado_id, imagen, "referencia")

    db.table("rostros_referencia").upsert(
        {
            "empleado_id": empleado_id,
            "descriptor": descriptor,
            "foto_referencia_path": ruta_foto,
        },
        on_conflict="empleado_id",
    ).execute()

    db.table("empleados").update({"rostro_registrado": True}).eq(
        "id", empleado_id
    ).execute()

    return {"registrado": True}


@app.post("/checar")
def checar(
    tipo: str = Form(...),
    foto: UploadFile = File(...),
    empleado_id: str = Depends(empleado_autenticado),
):
    """Verifica el rostro y, solo si coincide, registra la checada."""
    if tipo not in ("entrada", "salida"):
        raise HTTPException(422, "El tipo debe ser 'entrada' o 'salida'.")

    respuesta = (
        db.table("rostros_referencia")
        .select("descriptor")
        .eq("empleado_id", empleado_id)
        .limit(1)
        .execute()
    )
    if not respuesta.data:
        raise HTTPException(404, "Todavia no has registrado tu rostro.")

    ultima = (
        db.table("checadas")
        .select("tipo")
        .eq("empleado_id", empleado_id)
        .order("hora", desc=True)
        .limit(1)
        .execute()
    )
    ultimo_tipo = ultima.data[0]["tipo"] if ultima.data else None
    if tipo == "entrada" and ultimo_tipo == "entrada":
        raise HTTPException(409, "Ya registraste tu entrada; falta la salida.")
    if tipo == "salida" and ultimo_tipo != "entrada":
        raise HTTPException(409, "No hay una entrada abierta para registrar la salida.")

    imagen = preparar_imagen(foto.file.read())
    descriptor_nuevo = np.array(obtener_descriptor(imagen))
    descriptor_guardado = np.array(respuesta.data[0]["descriptor"])

    distancia = float(
        face_recognition.face_distance([descriptor_guardado], descriptor_nuevo)[0]
    )
    confianza = round(max(0.0, 1.0 - distancia), 2)

    if distancia > UMBRAL_COINCIDENCIA:
        return {"coincide": False, "confianza": confianza}

    # La foto de evidencia se guarda solo cuando la checada fue aceptada.
    subir_foto(empleado_id, imagen, "checadas")
    db.table("checadas").insert(
        {"empleado_id": empleado_id, "tipo": tipo, "metodo_biometrico": "rostro"}
    ).execute()

    return {"coincide": True, "confianza": confianza}

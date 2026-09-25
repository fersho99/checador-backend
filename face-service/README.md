# Servicio de verificacion facial

Microservicio gratuito (Python + FastAPI + face_recognition) para registrar
y verificar el rostro de un empleado contra la base de datos de Supabase.

## Uso local

En Windows usa Python 3.11 (no 3.14) y `dlib-bin`, porque `dlib` no compila sin Visual C++:

```
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install dlib-bin
pip install face_recognition==1.3.0 --no-deps
pip install face-recognition-models Click numpy==1.26.4 Pillow==10.4.0
pip install fastapi==0.115.0 "uvicorn[standard]==0.30.6" python-multipart==0.0.9 supabase==2.7.4 python-dotenv==1.0.1
```

En Linux/Mac basta `pip install -r requirements.txt`. Luego:

```
cp .env.example .env   # llenar con los valores reales del proyecto de Supabase
uvicorn main:app --reload --port 8000
```

## Endpoints

Los endpoints protegidos requieren el header `Authorization: Bearer <access_token>`
de la sesion de Supabase; el empleado se identifica por ese token.

- `POST /registrar-rostro` — form-data: `foto`. Calcula el descriptor facial y lo
  guarda en `rostros_referencia`. Responde 409 si ya hay un rostro registrado
  (para restablecerlo, un administrador borra su fila de `rostros_referencia` y
  pone `rostro_registrado = false`).
- `POST /checar` — form-data: `tipo` (`entrada`/`salida`), `foto`. Verifica el rostro
  y, solo si coincide, registra la checada. Regresa
  `{ "coincide": true/false, "confianza": 0.92 }`.
- `GET /salud` — para monitoreo del hosting (sin autenticacion).

Limitacion: no hay deteccion de vida, una foto impresa del empleado podria pasar.

## Despliegue gratuito

Funciona en cualquier hosting con capa gratuita para Python (Render, Railway,
Fly.io). Pasos generales:

1. Subir esta carpeta a su propio repositorio de Git.
2. Crear el servicio en el hosting elegido, apuntando a este repositorio.
3. Comando de arranque: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
4. Configurar las variables de entorno del `.env.example` en el panel del hosting.
5. Copiar la URL publica que asigna el hosting; esa es la URL que usan
   `registrarRostro()` y `checarConRostro()` desde la app movil.

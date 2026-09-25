-- Politicas de seguridad a nivel de fila.
-- Ejecutar despues de schema.sql.

alter table empleados enable row level security;
alter table dispositivos_pantalla enable row level security;
alter table checadas enable row level security;
alter table avisos_tablero enable row level security;
alter table contenido_multimedia enable row level security;
alter table rostros_referencia enable row level security;

-- empleados: cada quien ve su propia fila; las pantallas ven nombre/foto de todos
create policy empleados_select_propio
  on empleados for select
  using (auth_user_id = auth.uid());

create policy empleados_select_pantallas
  on empleados for select
  using (
    exists (
      select 1 from dispositivos_pantalla d
      where d.auth_user_id = auth.uid()
    )
  );

-- dispositivos_pantalla: solo lectura de su propia fila (para registrar ultima_conexion)
create policy dispositivos_select_propio
  on dispositivos_pantalla for select
  using (auth_user_id = auth.uid());

create policy dispositivos_update_propio
  on dispositivos_pantalla for update
  using (auth_user_id = auth.uid());

-- checadas: el empleado ve solo las suyas; las pantallas ven todas (solo lectura)
create policy checadas_select_propio
  on checadas for select
  using (
    empleado_id in (select id from empleados where auth_user_id = auth.uid())
  );

create policy checadas_select_pantallas
  on checadas for select
  using (
    exists (
      select 1 from dispositivos_pantalla d
      where d.auth_user_id = auth.uid()
    )
  );

-- checadas: desde la app solo se insertan checadas por huella (validada en el
-- dispositivo) y a nombre del propio empleado. Las checadas por rostro las inserta
-- unicamente el microservicio facial con la service_role key, tras verificar la cara.
create policy checadas_insert_propio
  on checadas for insert
  with check (
    metodo_biometrico = 'huella'
    and empleado_id in (select id from empleados where auth_user_id = auth.uid())
  );

-- avisos_tablero y contenido_multimedia: lectura para cualquier cuenta autenticada,
-- escritura reservada al panel de administracion (rol de servicio)
create policy avisos_select_autenticados
  on avisos_tablero for select
  using (auth.role() = 'authenticated');

create policy multimedia_select_autenticados
  on contenido_multimedia for select
  using (auth.role() = 'authenticated');

-- rostros_referencia: nadie lee ni escribe directo desde las apps;
-- solo el microservicio facial, usando la service_role key (bypassa RLS).
create policy rostros_sin_acceso_directo
  on rostros_referencia for select
  using (false);

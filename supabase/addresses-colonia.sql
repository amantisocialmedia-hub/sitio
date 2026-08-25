-- Colonia como campo propio en las direcciones.
--
-- Por qué: hasta ahora la colonia se escribía dentro de `line2`, junto con el
-- interior y las referencias ("Depto, colonia, referencias"). César lo levantó
-- el 25-ago-2026 al probar el alta de direcciones, y tiene razón: en México la
-- colonia es parte de la dirección postal —la paquetería la usa para rutear— y
-- las referencias son otra cosa ("portón verde, frente a la farmacia").
-- Revueltas, la colonia se pierde entre texto libre y la entrega sufre.
--
-- ORDEN IMPORTANTE: corre esto ANTES de desplegar el código que usa la columna.
-- La lectura del panel de cuenta hace select('*') y aguanta sin la columna, pero
-- el alta de direcciones y el snapshot del pedido la nombran explícitamente, y
-- sin ella fallan.
--
-- Es aditivo y no destructivo: nullable, sin default y sin tocar datos. Las
-- direcciones viejas conservan su colonia dentro de `line2` y siguen mostrándose
-- igual; nadie tiene que migrar nada a mano. Se puede correr más de una vez.

alter table public.addresses
  add column if not exists colonia text;

comment on column public.addresses.colonia is
  'Colonia / barrio. Parte de la direccion postal, separada de line2 (interior y referencias). Nullable: las direcciones anteriores a ago-2026 la traen dentro de line2.';

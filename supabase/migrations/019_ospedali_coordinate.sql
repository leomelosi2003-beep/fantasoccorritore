-- Coordinate reali degli ospedali (da OpenStreetMap)
update hospitals h set location = st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography
from (values
 ('Ospedale di Livorno', 43.5502649, 10.3246146),
 ('Ospedale di Cisanello (Pisa)', 43.7052512, 10.4434125),
 ('Ospedale di Cecina', 43.3152564, 10.5305983),
 ('Careggi (Firenze)', 43.8082970, 11.2483906),
 ('Meyer (Firenze)', 43.8102004, 11.2524735),
 ('Le Scotte (Siena)', 43.3435671, 11.3296733),
 ('San Luca (Lucca)', 43.8429301, 10.5323849),
 ('Ospedale del Cuore (Massa)', 44.0195201, 10.1532395),
 ('Gaslini (Genova)', 44.3915258, 8.9883856),
 ('San Martino (Genova)', 44.4094689, 8.9730883),
 ('Sant''Andrea (La Spezia)', 44.1124879, 9.8314158),
 ('Niguarda (Milano)', 45.5098717, 9.1860330),
 ('Gemelli (Roma)', 41.9315345, 12.4294393),
 ('Bambino Gesù (Roma)', 41.8970772, 12.4607003),
 ('Sant''Orsola (Bologna)', 44.4915307, 11.3609647),
 ('Rizzoli (Bologna)', 44.4801908, 11.3422100)
) v(name, lat, lng) where h.name = v.name;

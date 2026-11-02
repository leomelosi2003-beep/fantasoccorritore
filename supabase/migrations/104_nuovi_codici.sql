-- Nuovi rossi: Ictus (codice stroke), Politrauma da moto, Insufficienza respiratoria, Ustione grave, Shock anafilattico.
-- Nuovi gialli: Crisi convulsiva, Difficoltà respiratoria, Investimento pedone, Crisi ipoglicemica, Dolore addominale acuto.
-- Verdi un po' più frequenti (restano più dei gialli). Più servizi per giro e generate-missions ogni minuto (prima ogni 2).
-- set_mission_transport: Ictus -> cardio, Politrauma -> trauma_maggiore. (vedi SQL applicato)
select cron.alter_job((select jobid from cron.job where jobname='generate-missions'), schedule := '* * * * *');

-- Modalità automatica più veloce: auto-dispatch e complete-assignments ogni 10 secondi (prima ogni minuto).
select cron.alter_job((select jobid from cron.job where jobname='auto-dispatch'), schedule := '10 seconds');
select cron.alter_job((select jobid from cron.job where jobname='complete-assignments'), schedule := '10 seconds');

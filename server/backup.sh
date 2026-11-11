#!/usr/bin/env bash
# Backup notturno: solo LETTURA del database. Tiene gli ultimi 14 in /opt/fantasoccorritore/backup
BASE=/opt/fantasoccorritore; DIR=$BASE/backup; LOG=$BASE/gioco.log
stamp=$(date +%Y%m%d-%H%M); f=$DIR/fantasoccorritore-$stamp.dump
docker exec supabase-db pg_dump -U postgres -d postgres -Fc > $f || { echo "$(date '+%F %T') [backup] ERRORE pg_dump" >> $LOG; exit 1; }
tar -czf $DIR/storage-$stamp.tgz -C $BASE/supabase/volumes storage 2>/dev/null
ls -1t $DIR/fantasoccorritore-*.dump | tail -n +15 | xargs -r rm -f
ls -1t $DIR/storage-*.tgz | tail -n +15 | xargs -r rm -f
echo "$(date '+%F %T') [backup] OK $(du -h $f | cut -f1)" >> $LOG
# Ripristino (SOLO in caso di disastro):
#   docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists < file.dump

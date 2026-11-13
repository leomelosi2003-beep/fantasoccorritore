#!/usr/bin/env bash
# Da lanciare nella Cloud Shell di Oracle: crea la rete e il server ARM gratuito per FantaSoccorritore,
# riprovando finche' Oracle non trova posto. Il server poi si installa da solo (server/installa.sh).
set -uo pipefail
T=${OCI_TENANCY:?apri questo script dalla Cloud Shell di Oracle}
q() { oci "$@" 2>/dev/null; }

if q compute instance list -c $T --display-name fantaserver --lifecycle-state RUNNING --query 'data[0].id' --raw-output | grep -q ocid; then
  echo "fantaserver esiste gia'"; exit 0
fi
echo "Incolla la chiave Tailscale (tskey-auth-...) e premi Invio:"
KEY=""
while [ -z "$KEY" ] && read -r riga; do KEY=$(grep -o 'tskey-[A-Za-z0-9_-]*' <<< "$riga" | head -1); done
[ -n "$KEY" ] || { echo "chiave non trovata"; exit 1; }
echo "   chiave ricevuta"

echo ">> Rete"
VCN=$(q network vcn list -c $T --display-name fs-vcn --query 'data[0].id' --raw-output)
if [[ "$VCN" != ocid* ]]; then
  VCN=$(oci network vcn create -c $T --display-name fs-vcn --cidr-blocks '["10.0.0.0/16"]' --wait-for-state AVAILABLE --query 'data.id' --raw-output)
  IGW=$(oci network internet-gateway create -c $T --vcn-id $VCN --is-enabled true --display-name fs-igw --wait-for-state AVAILABLE --query 'data.id' --raw-output)
  RT=$(oci network vcn get --vcn-id $VCN --query 'data."default-route-table-id"' --raw-output)
  oci network route-table update --rt-id $RT --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]" --force >/dev/null
fi
SUB=$(q network subnet list -c $T --vcn-id $VCN --query 'data[0].id' --raw-output)
if [[ "$SUB" != ocid* ]]; then
  SUB=$(oci network subnet create -c $T --vcn-id $VCN --cidr-block 10.0.0.0/24 --display-name fs-subnet --wait-for-state AVAILABLE --query 'data.id' --raw-output)
fi
echo "   rete pronta"

AD=$(oci iam availability-domain list -c $T --query 'data[0].name' --raw-output)
IMG=$(oci compute image list -c $T --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
      --shape VM.Standard.A1.Flex --sort-by TIMECREATED --sort-order DESC --limit 1 --query 'data[0].id' --raw-output)
[[ "$IMG" == ocid* ]] || { echo "immagine Ubuntu non trovata"; exit 1; }
[ -f ~/.ssh/fantaserver ] || ssh-keygen -q -t ed25519 -N '' -f ~/.ssh/fantaserver
cat > ~/fs-init.sh <<EOF
#!/bin/bash
apt-get update -y && apt-get install -y git
git clone https://github.com/leomelosi2003-beep/fantasoccorritore /opt/fantasoccorritore/repo
bash /opt/fantasoccorritore/repo/server/installa.sh $KEY > /var/log/fs-installa.log 2>&1
EOF

echo ">> Creo il server (riprovo finche' Oracle non ha posto libero, puoi lasciare aperta questa pagina)"
for i in $(seq 1 2000); do
  for cfg in "2 12" "1 6"; do
    set -- $cfg
    out=$(oci compute instance launch -c $T --availability-domain "$AD" --display-name fantaserver \
      --shape VM.Standard.A1.Flex --shape-config "{\"ocpus\":$1,\"memoryInGBs\":$2}" \
      --image-id $IMG --subnet-id $SUB --assign-public-ip true --boot-volume-size-in-gbs 100 \
      --ssh-authorized-keys-file ~/.ssh/fantaserver.pub --user-data-file ~/fs-init.sh \
      --query 'data.id' --raw-output 2>&1)
    if [[ "$out" == ocid* ]]; then
      echo "FATTO: server creato ($1 OCPU, $2 GB). Si installa da solo in 10-15 minuti."
      rm -f ~/fs-init.sh; exit 0
    fi
    echo "$(date +%H:%M:%S) tentativo $i ($1 OCPU): $(echo "$out" | grep -o '"message": "[^"]*' | head -1 | cut -c13-90)"
  done
  sleep 60
done

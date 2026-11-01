import { equipmentIconSvg } from "@/components/equipmentIcons";

// Icona di un presidio: immagine caricata se c'è, altrimenti l'icona disegnata.
export default function EquipmentIcon({ code, url, size = 64 }: { code: string; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
  return <span style={{ display: "inline-block", width: size, height: size, lineHeight: 0 }}
               dangerouslySetInnerHTML={{ __html: equipmentIconSvg(code, size) }} />;
}

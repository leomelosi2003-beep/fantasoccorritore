import dynamic from "next/dynamic";

// Leaflet usa window: va caricato solo nel browser
const GameMap = dynamic(() => import("@/components/GameMap"), { ssr: false });

export default function Home() {
  return <GameMap />;
}

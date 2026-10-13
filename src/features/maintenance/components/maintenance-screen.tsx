import Image from "next/image"
import { maintenanceDefaultMessage, maintenanceDefaultTitle } from "@/features/maintenance/maintenance-content"

const maintenanceFallbackImage = "/images/Maintenance.webp"
const maintenanceBackgroundColor = "#040b1a"

export type MaintenanceScreenEntry = {
  path: string
  title: string
  message: string
  imageUrl: string | null
}

export function MaintenanceScreen({ entry }: { entry: MaintenanceScreenEntry }) {
  const imageSrc = entry.imageUrl || maintenanceFallbackImage

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10 text-foreground"
      style={{ backgroundColor: maintenanceBackgroundColor }}
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/20 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm">
        <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center border-b border-white/10 p-8 md:border-b-0 md:border-r md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">Maintenance</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">{entry.title || maintenanceDefaultTitle}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">{entry.message || maintenanceDefaultMessage}</p>
          </div>

          <div className="relative min-h-[320px] bg-[#09182c]" style={{ backgroundColor: maintenanceBackgroundColor }}>
            <Image
              src={imageSrc}
              alt={entry.title || "Maintenance notice"}
              fill
              sizes="(max-width: 767px) 100vw, 45vw"
              className="object-cover"
              unoptimized={Boolean(entry.imageUrl)}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

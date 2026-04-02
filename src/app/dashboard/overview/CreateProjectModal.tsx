import { Card, SectionTitle, Btn, Input, Select } from "@/components/ui/bluq-ui";

interface Props {
  onClose: () => void;
}

export default function CreateProjectModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1b1f2380] backdrop-blur-[2px]">
      <Card className="w-[480px] !p-8 shadow-2xl bg-white relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 text-[#8C959F] hover:text-[#24292f] transition-colors"
        >
          ✕
        </button>

        <SectionTitle className="!mb-1">Add New Project</SectionTitle>
        <p className="text-[13px] text-[#57606a] mb-6">
          Enter basic project details. You can edit these later in settings.
        </p>

        <div className="space-y-4">
          <Input label="Project Name *" placeholder="Al Nakheel Tower" />
          <Input label="Project Address *" placeholder="Dubai Marina, Dubai, UAE" />
          
          <div className="grid grid-cols-2 gap-4">
            <Select label="Stage *" options={["Foundation", "Structure", "Finishing"]} />
            <Select label="Type *" options={["Residential", "Commercial", "Mixed-Use"]} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date *" placeholder="2026-03-15" />
            <Input label="End Date *" placeholder="2026-09-30" />
          </div>

          <Input label="Project Code *" placeholder="ANT-2026-001" />
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <Btn onClick={onClose}>Back</Btn>
          <Btn primary className="px-6">Create Project →</Btn>
        </div>
      </Card>
    </div>
  );
}
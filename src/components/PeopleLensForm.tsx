import { useState } from 'react';
import { Users, Plus, X, Briefcase, GraduationCap, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  background: string;
  uniqueInsight: string;
}

interface PeopleLensFormProps {
  initialValue?: string;
  onSubmit: (formattedInput: string) => void;
  className?: string;
}

export function PeopleLensForm({ initialValue, onSubmit, className }: PeopleLensFormProps) {
  const [founderBio, setFounderBio] = useState(initialValue || '');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState<Omit<TeamMember, 'id'>>({
    name: '',
    role: '',
    background: '',
    uniqueInsight: '',
  });

  const addTeamMember = () => {
    if (!newMember.name.trim()) return;
    setTeamMembers(prev => [...prev, { ...newMember, id: `tm-${Date.now()}` }]);
    setNewMember({ name: '', role: '', background: '', uniqueInsight: '' });
    setShowAddMember(false);
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = () => {
    const parts: string[] = [];

    if (founderBio.trim()) {
      parts.push(`FOUNDER BIO:\n${founderBio.trim()}`);
    }

    if (teamMembers.length > 0) {
      const memberDescriptions = teamMembers.map(m =>
        `- ${m.name} (${m.role}): ${m.background}${m.uniqueInsight ? `. Unique Insight: ${m.uniqueInsight}` : ''}`
      ).join('\n');
      parts.push(`TEAM MEMBERS:\n${memberDescriptions}`);
    }

    onSubmit(parts.join('\n\n') || 'No team information provided.');
  };

  const isValid = founderBio.trim().length >= 20;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
          <Users className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Founder & Team Profile</h3>
          <p className="text-xs text-zinc-500">
            This lens requires YOUR input. Tell us about yourself and your team.
          </p>
        </div>
      </div>

      {/* Founder Bio */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
          <Briefcase className="w-3.5 h-3.5" />
          Your Background & Relevant Experience
        </label>
        <textarea
          value={founderBio}
          onChange={e => setFounderBio(e.target.value)}
          placeholder={"Tell us about yourself:\n- Years of experience in this domain\n- Previous roles relevant to this venture\n- Key insights you've gained from working in this space\n- Why YOU are uniquely positioned to solve this problem"}
          className="w-full h-40 bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none focus:border-pink-500/50 transition-colors"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-600">
            {founderBio.length} chars
            {founderBio.trim().length > 0 && founderBio.trim().length < 20 && (
              <span className="ml-2 text-amber-500">Need 20+ chars</span>
            )}
          </span>
        </div>
      </div>

      {/* Guiding Questions */}
      <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-lg p-4 space-y-2">
        <h4 className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
          Key questions to address:
        </h4>
        <ul className="text-xs text-zinc-500 space-y-1.5 ml-5 list-disc">
          <li>How many years have you worked in this specific industry?</li>
          <li>What "insider knowledge" do you have that outsiders can't easily learn?</li>
          <li>Have you experienced the problem you're solving firsthand?</li>
          <li>What did you do before that uniquely prepares you for this?</li>
          <li>Why would YOU succeed where others haven't?</li>
        </ul>
      </div>

      {/* Team Members */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
            <GraduationCap className="w-3.5 h-3.5" />
            Co-founders & Key Team (Optional)
          </label>
          {!showAddMember && (
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add member
            </button>
          )}
        </div>

        {/* Existing team members */}
        {teamMembers.map(member => (
          <div key={member.id} className="flex items-start gap-3 bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">{member.name}</span>
                <span className="text-xs text-pink-400/80">{member.role}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{member.background}</p>
              {member.uniqueInsight && (
                <p className="text-xs text-zinc-400 mt-1 italic">"{member.uniqueInsight}"</p>
              )}
            </div>
            <button
              onClick={() => removeTeamMember(member.id)}
              className="text-zinc-600 hover:text-zinc-400 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add member form */}
        {showAddMember && (
          <div className="bg-zinc-900/40 border border-pink-500/20 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={newMember.name}
                onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))}
                placeholder="Name"
                className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-pink-500/50"
              />
              <input
                value={newMember.role}
                onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}
                placeholder="Role (CTO, COO...)"
                className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-pink-500/50"
              />
            </div>
            <input
              value={newMember.background}
              onChange={e => setNewMember(p => ({ ...p, background: e.target.value }))}
              placeholder="Relevant experience (e.g., '8 years at Stripe, built payments infra')"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-pink-500/50"
            />
            <input
              value={newMember.uniqueInsight}
              onChange={e => setNewMember(p => ({ ...p, uniqueInsight: e.target.value }))}
              placeholder="Unique insight they bring (optional)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-pink-500/50"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={addTeamMember} disabled={!newMember.name.trim()} className="bg-pink-600 hover:bg-pink-500">
                Add Member
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddMember(false)} className="text-zinc-400">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="pt-2">
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40"
        >
          <Users className="w-4 h-4 mr-2" />
          Submit Team Profile for Analysis
        </Button>
        {!isValid && founderBio.trim().length > 0 && (
          <p className="text-xs text-amber-500 text-center mt-2">
            Please provide at least 20 characters about your background.
          </p>
        )}
      </div>
    </div>
  );
}

export interface AgentConfig {
  displayName: string;
  role: string;
  bgColor: string;      // Tailwind class for avatar bg (e.g. 'bg-[#f7b733]')
  textOnBg: string;     // Text color ON avatar bg (e.g. 'text-[#1a1200]')
  nameColor: string;    // Tailwind class for name text (e.g. 'text-amber-500')
  initial: string;      // Single character
  /** Phase 17.1: agent's underlying model can natively process image bytes
   *  via the OpenClaw CLI bridge (Mo, Jarvis on Anthropic Opus). When
   *  false, the agent receives only the textual description from
   *  extractImageDescription in the prepended attachment block. */
  visionCapable?: boolean;
}

export const AGENT_CONFIG: Record<string, AgentConfig> = {
  mo: {
    displayName: 'Mo',
    role: 'Senior Partner',
    bgColor: 'bg-[#f7b733]',
    textOnBg: 'text-[#1a1200]',
    nameColor: 'text-amber-500',
    initial: 'M',
    visionCapable: true,
  },
  jarvis: {
    displayName: 'Jarvis',
    role: 'Analyst Extraordinaire',
    bgColor: 'bg-[#4db6ac]',
    textOnBg: 'text-[#062822]',
    nameColor: 'text-teal-500',
    initial: 'J',
    visionCapable: true,
  },
  sentinel: {
    displayName: 'Sentinel',
    role: 'quality monitor',
    bgColor: 'bg-[#c86bff]',
    textOnBg: 'text-[#2b0748]',
    nameColor: 'text-purple-400',
    initial: 'S',
    visionCapable: false,
  },
  user: {
    displayName: 'You',
    role: '',
    bgColor: 'bg-[#6ea8fe]',
    textOnBg: 'text-[#07162b]',
    nameColor: 'text-blue-400',
    initial: 'U',
    // No visionCapable — user is not an agent.
  },
  herman: {
    displayName: 'Herman',
    role: 'Resident Contrarian',
    bgColor: 'bg-[#a855f7]',
    textOnBg: 'text-[#1a0833]',
    nameColor: 'text-purple-400',
    initial: 'H',
    visionCapable: false,
  },
  sam: {
    displayName: 'Sam',
    role: 'Sentinel',
    bgColor: 'bg-[#ef4444]',
    textOnBg: 'text-[#3a0808]',
    nameColor: 'text-red-400',
    initial: 'S',
    visionCapable: false,
  },
};

const DEFAULT_CONFIG: AgentConfig = {
  displayName: 'Agent',
  role: '',
  bgColor: 'bg-gray-500',
  textOnBg: 'text-white',
  nameColor: 'text-gray-400',
  initial: '?',
};

export function getAgentConfig(agentId: string): AgentConfig {
  return AGENT_CONFIG[agentId.toLowerCase()] ?? {
    ...DEFAULT_CONFIG,
    displayName: agentId,
    initial: agentId.charAt(0).toUpperCase(),
  };
}

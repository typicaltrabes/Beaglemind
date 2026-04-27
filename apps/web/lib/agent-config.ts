export interface AgentConfig {
  displayName: string;
  role: string;
  bgColor: string;      // Tailwind class for avatar bg (e.g. 'bg-[#f7b733]')
  textOnBg: string;     // Text color ON avatar bg (e.g. 'text-[#1a1200]')
  nameColor: string;    // Tailwind class for name text (e.g. 'text-amber-500')
  initial: string;      // Single character
}

export const AGENT_CONFIG: Record<string, AgentConfig> = {
  mo: {
    displayName: 'Mo',
    role: 'Senior Partner',
    bgColor: 'bg-[#f7b733]',
    textOnBg: 'text-[#1a1200]',
    nameColor: 'text-amber-500',
    initial: 'M',
  },
  jarvis: {
    displayName: 'Jarvis',
    role: 'Analyst Extraordinaire',
    bgColor: 'bg-[#4db6ac]',
    textOnBg: 'text-[#062822]',
    nameColor: 'text-teal-500',
    initial: 'J',
  },
  sentinel: {
    displayName: 'Sentinel',
    role: 'quality monitor',
    bgColor: 'bg-[#c86bff]',
    textOnBg: 'text-[#2b0748]',
    nameColor: 'text-purple-400',
    initial: 'S',
  },
  user: {
    displayName: 'You',
    role: '',
    bgColor: 'bg-[#6ea8fe]',
    textOnBg: 'text-[#07162b]',
    nameColor: 'text-blue-400',
    initial: 'U',
  },
  herman: {
    displayName: 'Herman',
    role: 'Resident Contrarian',
    bgColor: 'bg-[#a855f7]',
    textOnBg: 'text-[#1a0833]',
    nameColor: 'text-purple-400',
    initial: 'H',
  },
  sam: {
    displayName: 'Sam',
    role: 'Sentinel',
    bgColor: 'bg-[#ef4444]',
    textOnBg: 'text-[#3a0808]',
    nameColor: 'text-red-400',
    initial: 'S',
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

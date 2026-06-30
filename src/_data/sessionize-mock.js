/**
 * Mock Sessionize data for local development and testing.
 * Mimics the structure of real Sessionize API responses.
 * 
 * To use: set environment variable USE_MOCK_SESSIONIZE=true when building
 * Example: USE_MOCK_SESSIONIZE=true bun run build
 */

export default {
  eventId: "xx320rm2",
  sessions: [
    {
      id: "session-1",
      title: "Building Resilient APIs with Node.js",
      description:
        "Learn best practices for building scalable and resilient REST APIs using Node.js and Express. We'll cover error handling, rate limiting, caching strategies, and deployment considerations.",
      startsAt: "2026-10-19T09:00:00",
      endsAt: "2026-10-19T09:45:00",
      roomId: "room-1",
      speakers: ["speaker-1"],
      isServiceSession: false,
      isPlenumSession: false,
    },
    {
      id: "session-2",
      title: "Modern CSS Grid & Flexbox Mastery",
      description:
        "Master modern CSS layout techniques. We'll explore CSS Grid and Flexbox in depth, with real-world examples and performance considerations.",
      startsAt: "2026-10-19T09:00:00",
      endsAt: "2026-10-19T09:45:00",
      roomId: "room-2",
      speakers: ["speaker-2"],
      isServiceSession: false,
      isPlenumSession: false,
    },
    {
      id: "session-3",
      title: "Keynote: The Future of Web Development",
      description:
        "An inspiring keynote address on emerging trends and technologies shaping the future of web development.",
      startsAt: "2026-10-19T10:00:00",
      endsAt: "2026-10-19T10:45:00",
      roomId: "room-plenary",
      speakers: ["speaker-3"],
      isServiceSession: false,
      isPlenumSession: true,
    },
    {
      id: "session-4",
      title: "TypeScript Advanced Patterns",
      description:
        "Deep dive into advanced TypeScript patterns including generics, conditional types, utility types, and type guards. Perfect for intermediate TS developers.",
      startsAt: "2026-10-19T11:00:00",
      endsAt: "2026-10-19T11:45:00",
      roomId: "room-3",
      speakers: ["speaker-4", "speaker-5"],
      isServiceSession: false,
      isPlenumSession: false,
    },
    {
      id: "session-5",
      title: "React Hooks & Performance Optimization",
      description:
        "Unlock the full power of React Hooks. Learn how to write efficient components, manage state correctly, and optimize performance with useMemo, useCallback, and Suspense.",
      startsAt: "2026-10-19T11:00:00",
      endsAt: "2026-10-19T11:45:00",
      roomId: "room-1",
      speakers: ["speaker-6"],
      isServiceSession: false,
      isPlenumSession: false,
    },
  ],
  speakers: [
    {
      id: "speaker-1",
      firstName: "Alice",
      lastName: "Johnson",
      profilePicture: "/assets/images/sessionize/avatar-1.svg",
      tagLine: "Senior Backend Engineer at TechCorp",
      bio: "Alice has 10+ years of experience building scalable backend systems. She's passionate about clean code and mentoring junior developers.",
      twitter: "alice_codes",
      linkedIn: "https://linkedin.com/in/alice-johnson",
      blog: "https://alice-codes.dev",
    },
    {
      id: "speaker-2",
      firstName: "Bob",
      lastName: "Smith",
      profilePicture: "/assets/images/sessionize/avatar-2.svg",
      tagLine: "Frontend Lead at DesignStudio",
      bio: "Bob specializes in modern CSS and web performance. He loves creative solutions and teaching others about responsive design.",
      twitter: "bob_frontend",
      linkedIn: "https://linkedin.com/in/bob-smith",
      blog: null,
    },
    {
      id: "speaker-3",
      firstName: "Carol",
      lastName: "Williams",
      profilePicture: "/assets/images/sessionize/avatar-3.svg",
      tagLine: "CTO & Web Pioneer",
      bio: "Carol has been pioneering web technologies since the early 2000s. She's a thought leader and frequent conference speaker.",
      twitter: "carol_web",
      linkedIn: "https://linkedin.com/in/carol-williams",
      blog: "https://carol-thoughts.com",
    },
    {
      id: "speaker-4",
      firstName: "David",
      lastName: "Chen",
      profilePicture: "/assets/images/sessionize/avatar-4.svg",
      tagLine: "TypeScript Expert at FrameworkCo",
      bio: "David is a TypeScript expert with a passion for static typing and developer experience. He maintains several popular TS libraries.",
      twitter: "david_ts",
      linkedIn: "https://linkedin.com/in/david-chen",
      blog: null,
    },
    {
      id: "speaker-5",
      firstName: "Eve",
      lastName: "Martinez",
      profilePicture: "/assets/images/sessionize/avatar-5.svg",
      tagLine: "Full Stack Developer at StartupX",
      bio: "Eve brings a unique full-stack perspective to every project. She's particularly interested in developer tooling and DX.",
      twitter: "eve_fullstack",
      linkedIn: "https://linkedin.com/in/eve-martinez",
      blog: "https://eve-dev.com",
    },
    {
      id: "speaker-6",
      firstName: "Frank",
      lastName: "Thompson",
      profilePicture: "/assets/images/sessionize/avatar-6.svg",
      tagLine: "React Specialist at UICompany",
      bio: "Frank has been working with React since v0.11. He's an advocate for performance optimization and component architecture best practices.",
      twitter: null,
      linkedIn: "https://linkedin.com/in/frank-thompson",
      blog: "https://frank-react.dev",
    },
  ],
  rooms: [
    {
      id: "room-1",
      name: "Room A - Backend Track",
    },
    {
      id: "room-2",
      name: "Room B - Frontend Track",
    },
    {
      id: "room-3",
      name: "Room C - Full Stack Track",
    },
    {
      id: "room-plenary",
      name: "Grand Ballroom - Plenary",
    },
  ],
  timeSlots: [
    {
      slotStart: "2026-10-19T09:00:00",
      slotEnd: "2026-10-19T09:45:00",
    },
    {
      slotStart: "2026-10-19T10:00:00",
      slotEnd: "2026-10-19T10:45:00",
    },
    {
      slotStart: "2026-10-19T11:00:00",
      slotEnd: "2026-10-19T11:45:00",
    },
  ],
};

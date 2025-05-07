// apiConfig.ts
export const API_ROUTES = {
  ROOMS: {
    CREATE: '/api/rooms',
    SEARCH: '/api/rooms/search',
    ALL: '/api/rooms/all',
    JOIN: (roomId: string) => `/api/rooms/${roomId}/join`,
    LEAVE: (roomId: string) => `/api/rooms/${roomId}/leave`,
    SWITCH: '/api/rooms/switch',
  },
  NOTIFICATIONS: {
    ACCEPT: (notificationId: string) => `/api/notifications/${notificationId}/accept`,
  },
} as const;

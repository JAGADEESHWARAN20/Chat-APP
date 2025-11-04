export const API_ROUTES = {
    MESSAGES: {
      SEND: '/api/messages/send',
      READ_ALL: '/api/messages/read-all',
      BY_ROOM: (roomId: string) => `/api/messages/${roomId}`,
    },
    ROOMS: {
      CREATE: '/api/rooms/create',
      SEARCH: '/api/rooms/all', // Updated to match actual route
      ALL: '/api/rooms/all',
      JOINED: '/api/rooms/joined',
      JOIN: (roomId: string) => `/api/rooms/${roomId}/join`,
      LEAVE: (roomId: string) => `/api/rooms/${roomId}/leave`,
      SWITCH: '/api/rooms/switch',
    },
    NOTIFICATIONS: {
      BASE: '/api/notifications',
      ACTION: (notificationId: string) => `/api/notifications/${notificationId}`,
      ACCEPT: (notificationId: string) => `/api/notifications/${notificationId}/accept`,
      READ: (notificationId: string) => `/api/notifications/${notificationId}/read`,
      UNREAD: (notificationId: string) => `/api/notifications/${notificationId}/unread`,
      REJECT: (notificationId: string) => `/api/notifications/${notificationId}/reject`,
    },
    USERS: {
      SEARCH: '/api/users/search',
    },
  } as const;
  
  export type ApiRoute = typeof API_ROUTES;
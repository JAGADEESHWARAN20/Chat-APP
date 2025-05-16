export const mapErrorCodeToMessage = (code: string, defaultMessage: string): string => {
     const errorMap: Record<string, string> = {
          AUTH_REQUIRED: "Please log in to perform this action.",
          INVALID_ROOM_ID: "The room ID is invalid.",
          ROOM_NOT_FOUND: "The room does not exist.",
          NOTIFICATION_NOT_FOUND: "The notification does not exist.",
          ACTION_FAILED: "The action could not be completed. Please try again.",
          // Add more as needed
     };
     return errorMap[code] || defaultMessage;
};
// import { create } from "zustand";
// import toast from "react-hot-toast";
// import { axiosInstance } from "../lib/axios";
// import { useAuthStore } from "./useAuthStore";

// export const useChatStore = create((set, get) => ({
//   messages: [],
//   users: [],
//   selectedUser: null,
//   isUsersLoading: false,
//   isMessagesLoading: false,

//   getUsers: async () => {
//     set({ isUsersLoading: true });
//     try {
//       const res = await axiosInstance.get("/messages/users");
//       set({ users: res.data });
//     } catch (error) {
//       toast.error(error.response.data.message);
//     } finally {
//       set({ isUsersLoading: false });
//     }
//   },

//   getMessages: async (userId) => {
//     set({ isMessagesLoading: true });
//     try {
//       const res = await axiosInstance.get(`/messages/${userId}`);
//       set({ messages: res.data });
//     } catch (error) {
//       toast.error(error.response.data.message);
//     } finally {
//       set({ isMessagesLoading: false });
//     }
//   },
//   sendMessage: async (messageData) => {
//     const { selectedUser, messages } = get();
//     try {
//       const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
//       set({ messages: [...messages, res.data] });
//     } catch (error) {
//       toast.error(error.response.data.message);
//     }
//   },

//   subscribeToMessages: () => {
//     const { selectedUser } = get();
//     if (!selectedUser) return;

//     const socket = useAuthStore.getState().socket;

//     socket.on("newMessage", (newMessage) => {
//       const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
//       if (!isMessageSentFromSelectedUser) return;

//       set({
//         messages: [...get().messages, newMessage],
//       });
//     });
//   },

//   unsubscribeFromMessages: () => {
//     const socket = useAuthStore.getState().socket;
//     socket.off("newMessage");
//   },

//   setSelectedUser: (selectedUser) => set({ selectedUser }),
// }));

import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  // State
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  replySuggestions: [],
  
  // Actions

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set(state => ({
        messages: res.data,
        isMessagesLoading: false
      }));
    } catch (error) {
      console.error('Failed to get messages:', error);
      toast.error(error.response?.data?.message || 'Failed to load messages');
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser } = get();
    if (!selectedUser?._id) {
      throw new Error('No user selected');
    }
    
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      // Do NOT mutate messages here; WebSocket will deliver the authoritative message
      return res.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    const messageHandler = async (newMessage) => {
      const currentState = get();
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      
      // Update messages
      set({
        messages: [...currentState.messages, newMessage]
      });

      // Only fetch suggestions if the message is from the other user
      if (isMessageSentFromSelectedUser) {
        try {
          const suggestions = await currentState.getReplySuggestions(selectedUser._id);
          set({ replySuggestions: suggestions });
        } catch (error) {
          console.error("Failed to fetch reply suggestions:", error);
          set({ replySuggestions: [] });
        }
      }
    };

    socket.on("newMessage", messageHandler);
    
    // Return cleanup function
    return () => {
      socket.off("newMessage", messageHandler);
    };
  },

  unsubscribeFromMessages: () => {
    // Cleanup is now handled by the subscribeToMessages return function
  },

  getReplySuggestions: async (userId) => {
    try {
      const res = await axiosInstance.get(`/messages/${userId}/suggestions`);
      return res.data.suggestions || [];
    } catch (error) {
      console.error("Failed to get reply suggestions:", error);
      return [];
    }
  },

  setSelectedUser: (selectedUser) => set({ selectedUser, replySuggestions: [] }),
  clearReplySuggestions: () => {
    set({ replySuggestions: [] });
  },
  
  addMessage: (newMessage) => {
    set(state => {
      // Prevent duplicate messages
      if (state.messages.some(msg => msg._id === newMessage._id)) {
        return state;
      }
      return {
        messages: [...state.messages, newMessage]
      };
    });
  },

  upsertMessage: (msg) => {
    set(state => {
      const byClientIdIndex = msg.clientId
        ? state.messages.findIndex(m => m.clientId && m.clientId === msg.clientId)
        : -1;
      const byIdIndex = msg._id
        ? state.messages.findIndex(m => m._id === msg._id)
        : -1;

      const idx = byClientIdIndex !== -1 ? byClientIdIndex : byIdIndex;
      if (idx !== -1) {
        const copy = state.messages.slice();
        copy[idx] = { ...copy[idx], ...msg, isSending: false, isError: false };
        return { messages: copy };
      }
      return { messages: [...state.messages, msg] };
    });
  },
}));

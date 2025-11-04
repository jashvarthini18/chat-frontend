// import { useRef, useState } from "react";
// import { useChatStore } from "../store/useChatStore";
// import { Image, Send, X } from "lucide-react";
// import toast from "react-hot-toast";

// const MessageInput = () => {
//   const [text, setText] = useState("");
//   const [imagePreview, setImagePreview] = useState(null);
//   const fileInputRef = useRef(null);
//   const { sendMessage } = useChatStore();

//   const handleImageChange = (e) => {
//     const file = e.target.files[0];
//     if (!file.type.startsWith("image/")) {
//       toast.error("Please select an image file");
//       return;
//     }

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       setImagePreview(reader.result);
//     };
//     reader.readAsDataURL(file);
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   const handleSendMessage = async (e) => {
//     e.preventDefault();
//     if (!text.trim() && !imagePreview) return;

//     try {
//       await sendMessage({
//         text: text.trim(),
//         image: imagePreview,
//       });

//       // Clear form
//       setText("");
//       setImagePreview(null);
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     } catch (error) {
//       console.error("Failed to send message:", error);
//     }
//   };

//   return (
//     <div className="p-4 w-full">
//       {imagePreview && (
//         <div className="mb-3 flex items-center gap-2">
//           <div className="relative">
//             <img
//               src={imagePreview}
//               alt="Preview"
//               className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
//             />
//             <button
//               onClick={removeImage}
//               className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
//               flex items-center justify-center"
//               type="button"
//             >
//               <X className="size-3" />
//             </button>
//           </div>
//         </div>
//       )}

//       <form onSubmit={handleSendMessage} className="flex items-center gap-2">
//         <div className="flex-1 flex gap-2">
//           <input
//             type="text"
//             className="w-full input input-bordered rounded-lg input-sm sm:input-md"
//             placeholder="Type a message..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//           />
//           <input
//             type="file"
//             accept="image/*"
//             className="hidden"
//             ref={fileInputRef}
//             onChange={handleImageChange}
//           />

//           <button
//             type="button"
//             className={`hidden sm:flex btn btn-circle
//                      ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
//             onClick={() => fileInputRef.current?.click()}
//           >
//             <Image size={20} />
//           </button>
//         </div>
//         <button
//           type="submit"
//           className="btn btn-sm btn-circle"
//           disabled={!text.trim() && !imagePreview}
//         >
//           <Send size={22} />
//         </button>
//       </form>
//     </div>
//   );
// };
// export default MessageInput;
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { useSocket } from "../contexts/SocketContext";
import { useAuthStore } from "../store/useAuthStore";

const MessageInput = ({ currentChatId, onNewMessage }) => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  // Select store values individually to prevent unnecessary re-renders
  const sendMessage = useChatStore(useCallback(state => state.sendMessage, []));
  const replySuggestions = useChatStore(useCallback(state => state.replySuggestions, []));
  const clearReplySuggestions = useChatStore(useCallback(state => state.clearReplySuggestions, []));
  const addMessage = useChatStore(useCallback(state => state.addMessage, []));
  const upsertMessage = useChatStore(useCallback(state => state.upsertMessage, []));
  const selectedUser = useChatStore(useCallback(state => state.selectedUser, []));
  
  // Memoize the reply suggestions to prevent unnecessary re-renders
  const memoizedReplySuggestions = useMemo(() => replySuggestions || [], [replySuggestions]);
  const socket = useSocket();
  const { authUser } = useAuthStore();

  // Compute a deterministic room id from both user ids so both sides join the same room
  const roomId = useMemo(() => {
    const a = authUser?._id;
    const b = selectedUser?._id;
    if (!a || !b) return null;
    return [a, b].sort().join(":");
  }, [authUser?._id, selectedUser?._id]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSuggestionClick = (suggestion) => {
    setText(suggestion);
    clearReplySuggestions();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!roomId) {
      console.error('Cannot send message: currentChatId is missing');
      toast.error('Please select a conversation first');
      return;
    }
    
    if (!text.trim() && !imagePreview) {
      console.log('Message not sent - message is empty');
      toast.error('Please enter a message or select an image');
      return;
    }

    console.log('Sending message...');
    
    try {
      const messageData = {
        text: text.trim(),
        image: imagePreview,
        chatId: roomId,
        sender: authUser._id,
        senderName: authUser.username,
        createdAt: new Date().toISOString()
      };

      console.log('Message data:', messageData);

      // Update local state immediately for instant feedback
      const clientId = `${authUser._id}-${Date.now()}`;
      const tempMessage = {
        ...messageData,
        _id: Date.now().toString(),
        clientId,
        sender: { _id: authUser._id, username: authUser.username },
        senderId: authUser._id,
        createdAt: new Date(),
        isSending: true
      };
      
      upsertMessage(tempMessage);
      console.log('Local message added:', tempMessage);

      // Send message via WebSocket
      if (socket && socket.connected) {
        console.log('Socket is connected, emitting sendMessage');
        console.log('Message data being sent:', JSON.stringify(messageData, null, 2));
        
        // Add a timeout for the acknowledgement
        const ackTimeout = setTimeout(() => {
          console.warn('No acknowledgement received from server after 5 seconds');
        }, 5000);
        
        try {
          socket.emit('sendMessage', { ...messageData, clientId }, (acknowledgement) => {
            clearTimeout(ackTimeout);
            console.log('Server acknowledged message:', acknowledgement);
            
            if (!acknowledgement) {
              console.error('No acknowledgement received from server');
              return;
            }
            
            if (acknowledgement.success) {
              console.log('Message sent successfully');
            } else {
              console.error('Server reported error:', acknowledgement.error);
            }
          });
        } catch (error) {
          clearTimeout(ackTimeout);
          console.error('Error emitting message:', error);
        }
      } else {
        console.error('Socket is not connected. Socket state:', {
          connected: socket?.connected,
          disconnected: socket?.disconnected,
          id: socket?.id
        });
      }

      // Clear form
      setText("");
      setImagePreview(null);
      clearReplySuggestions();
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Also send to the backend for persistence
      try {
        console.log('Saving message to backend...');
        const response = await sendMessage({
          text: messageData.text,
          image: messageData.image,
          chatId: currentChatId
        });
        console.log('Message saved to backend:', response);
      } catch (error) {
        console.error("Failed to save message:", error);
        // Update message status to failed
        upsertMessage({
          ...tempMessage,
          isSending: false,
          isError: true
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  // Memoize the message handler to prevent recreation on every render
  const handleNewMessage = useCallback((message) => {
    if (!roomId || message.chatId !== roomId) {
      return;
    }

    console.log('Received new message for current chat:', message);
    
    const newMessage = {
      ...message,
      _id: message._id || `temp-${Date.now()}`,
      clientId: message.clientId,
      sender: typeof message.sender === 'string' 
        ? { _id: message.sender, username: message.senderName || 'User' } 
        : message.sender,
      senderId: message.senderId || (typeof message.sender === 'string' ? message.sender : message.sender?._id),
      createdAt: message.createdAt ? new Date(message.createdAt) : new Date()
    };
    
    console.log('Upserting message to UI:', newMessage);
    upsertMessage(newMessage);
    
    if (onNewMessage) {
      onNewMessage(newMessage);
    }
  }, [roomId, upsertMessage, onNewMessage]);

  // Join/leave chat room when roomId changes
  useEffect(() => {
    if (!socket || !roomId) return;

    console.log(`Joining chat room: ${roomId}`);
    socket.emit('joinChat', roomId);

    // Setup message listener
    socket.on('newMessage', handleNewMessage);

    // Clean up
    return () => {
      console.log(`Leaving chat room: ${roomId}`);
      socket.emit('leaveChat', roomId);
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, roomId, handleNewMessage]);

  // Setup socket connection listeners with useRef to maintain stable references
  const handlersRef = useRef({
    handleConnect: () => {
      console.log('Socket connected in MessageInput');
      if (roomId) {
        console.log(`Re-joining chat room after reconnect: ${roomId}`);
        socket.emit('joinChat', roomId);
      }
    },
    handleDisconnect: (reason) => {
      console.log('Socket disconnected:', reason);
    },
    handleConnectError: (error) => {
      console.error('Socket connection error:', error);
    }
  });

  // Update handler refs when dependencies change
  useEffect(() => {
    handlersRef.current = {
      handleConnect: () => {
        console.log('Socket connected in MessageInput');
        if (currentChatId) {
          console.log(`Re-joining chat room after reconnect: ${currentChatId}`);
          socket.emit('joinChat', currentChatId);
        }
      },
      handleDisconnect: (reason) => {
        console.log('Socket disconnected:', reason);
      },
      handleConnectError: (error) => {
        console.error('Socket connection error:', error);
      }
    };
  }, [socket, roomId]);

  // Setup socket connection listeners
  useEffect(() => {
    if (!socket) return;

    const { handleConnect, handleDisconnect, handleConnectError } = handlersRef.current;

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);

  return (
    <div className="relative">
      {/* Reply Suggestions */}
      {memoizedReplySuggestions.length > 0 && (
        <div className="flex gap-2 p-2 bg-gray-50 dark:bg-gray-800 overflow-x-auto">
          {memoizedReplySuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600 whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {imagePreview && (
          <div className="mb-3 flex items-center gap-2">
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
              <button
                onClick={removeImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
                flex items-center justify-center"
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              className="w-full input input-bordered rounded-lg input-sm sm:input-md"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />
            <button
              type="button"
              className={`hidden sm:flex btn btn-circle ${
                imagePreview ? "text-emerald-500" : "text-zinc-400"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Image size={20} />
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-sm btn-circle"
            disabled={!text.trim() && !imagePreview}
          >
            <Send size={22} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default MessageInput;

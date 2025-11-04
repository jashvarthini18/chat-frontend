import { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from "../store/useAuthStore";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const authSocket = useAuthStore(state => state.socket);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Provide the same socket instance managed by useAuthStore
    setSocket(authSocket || null);

    if (!authSocket) return;

    const handleConnect = () => {
      console.log('WebSocket connected:', authSocket.id);
    };
    const handleDisconnect = (reason) => {
      console.log('WebSocket disconnected:', reason);
    };
    const handleError = (err) => {
      console.error('WebSocket connection error:', err);
    };

    authSocket.on('connect', handleConnect);
    authSocket.on('disconnect', handleDisconnect);
    authSocket.on('connect_error', handleError);

    return () => {
      // Do NOT disconnect here; useAuthStore controls lifecycle
      authSocket.off('connect', handleConnect);
      authSocket.off('disconnect', handleDisconnect);
      authSocket.off('connect_error', handleError);
    };
  }, [authSocket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

export default SocketContext;

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { searchMarketplaceProfiles, getMarketplaceProfile } from '../utils/marketplaceAPI';
import LensPrescription from './LensPrescription';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  where, 
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import toast from 'react-hot-toast';

const MarketplaceChat = () => {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  // Chat system states
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeChats, setActiveChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  
  // Marketplace search states
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Real-time listeners and notifications
  const [messageListeners, setMessageListeners] = useState({});
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  // Attachment states
  const [showAttachments, setShowAttachments] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionData, setPrescriptionData] = useState({
    rightSph: '',
    rightCyl: '',
    rightAxis: '',
    rightAdd: '',
    leftSph: '',
    leftCyl: '',
    leftAxis: '',
    leftAdd: '',
    rightQty: '1',
    leftQty: '1'
  });

  // Scroll management
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserChats();
    }
    return () => {
      // Cleanup all listeners
      Object.values(messageListeners).forEach(unsubscribe => unsubscribe());
    };
  }, [user]);

  useEffect(() => {
    // Count unread messages and manage notifications
    if (!isExpanded) {
      let totalUnread = 0;
      Object.values(chatMessages).forEach(messages => {
        const unreadInChat = messages.filter(msg => 
          msg.sender !== user?.uid && 
          msg.type !== 'system' &&
          !msg.readBy?.[user?.uid]
        ).length;
        totalUnread += unreadInChat;
      });
      setUnreadMessages(totalUnread);
      setShowNotification(totalUnread > 0);
    } else {
      if (currentChatId && chatMessages[currentChatId]) {
        markChatMessagesAsRead(currentChatId);
      }
      setUnreadMessages(0);
      setShowNotification(false);
    }
  }, [chatMessages, isExpanded, user, currentChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, currentChatId]);

  const scrollToBottom = () => {
    if (autoScrollEnabled && !isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScroll = (e) => {
    const container = e.target;
    const isScrolledToBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    
    if (isScrolledToBottom) {
      setAutoScrollEnabled(true);
      setIsUserScrolling(false);
    } else {
      setAutoScrollEnabled(false);
      setIsUserScrolling(true);
    }
  };

  const generateChatId = (userId1, userId2) => {
    const sortedIds = [userId1, userId2].sort();
    return `${sortedIds[0]}_${sortedIds[1]}`;
  };

  const loadUserChats = async () => {
    if (!user) return;

    try {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const userChats = [];
      
      querySnapshot.forEach((doc) => {
        const chatData = doc.data();
        const otherParticipantId = chatData.participants.find(id => id !== user.uid);
        
        // Try to get shop info from multiple sources
        let shopInfo = chatData.shopInfo;
        
        if (!shopInfo || !shopInfo.shopName) {
          // Fallback to user-specific data in chat
          const otherUserData = chatData[`user_${otherParticipantId}`];
          if (otherUserData) {
            shopInfo = {
              shopName: otherUserData.shopName || 'Unknown Shop',
              address: otherUserData.address || { city: 'Unknown City' }
            };
          } else {
            shopInfo = {
              shopName: 'Unknown Shop',
              address: { city: 'Unknown City' }
            };
          }
        }
        
        userChats.push({
          id: doc.id,
          otherUserId: otherParticipantId,
          shopInfo: shopInfo,
          lastMessage: chatData.lastMessage || 'No messages yet',
          lastMessageTime: chatData.lastMessageTime?.toDate() || new Date(),
          createdAt: chatData.createdAt?.toDate() || new Date()
        });
      });

      userChats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setActiveChats(userChats);

      userChats.forEach(chat => {
        setupMessageListener(chat.id);
      });

    } catch (error) {
      console.error('Error loading user chats:', error);
    }
  };

  const setupMessageListener = (chatId) => {
    if (messageListeners[chatId]) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        const messageData = doc.data();
        messages.push({
          id: doc.id,
          ...messageData,
          timestamp: messageData.timestamp?.toDate() || new Date()
        });
      });
      
      setChatMessages(prev => ({
        ...prev,
        [chatId]: messages
      }));
    });

    setMessageListeners(prev => ({
      ...prev,
      [chatId]: unsubscribe
    }));
  };

  const markChatMessagesAsRead = async (chatId) => {
    if (!user?.uid || !chatMessages[chatId]) return;
    
    try {
      const unreadMessages = chatMessages[chatId].filter(msg => 
        msg.sender !== user.uid && 
        msg.type !== 'system' && 
        !msg.readBy?.[user.uid]
      );

      const updatePromises = unreadMessages.map(async (message) => {
        const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
        await updateDoc(messageRef, {
          [`readBy.${user.uid}`]: serverTimestamp()
        });
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const searchShops = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const profiles = await searchMarketplaceProfiles({
        searchTerm: searchTerm.trim()
      });
      
      // Filter out current user
      const filteredProfiles = profiles.filter(profile => profile.uid !== user.uid);
      setSearchResults(filteredProfiles);
    } catch (error) {
      console.error('Error searching marketplace profiles:', error);
      toast.error('Failed to search shops');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const startChat = async (shopProfile, initialMessage = null) => {
    const chatId = generateChatId(user.uid, shopProfile.uid);
    
    try {
      const existingChat = activeChats.find(chat => chat.id === chatId);
      
      if (!existingChat) {
        const chatData = {
          participants: [user.uid, shopProfile.uid],
          createdAt: serverTimestamp(),
          lastMessage: initialMessage || 'Chat started',
          lastMessageTime: serverTimestamp(),
          shopInfo: {
            shopName: shopProfile.shopName || shopProfile.displayName,
            address: shopProfile.address,
            contact: shopProfile.contact,
            businessInfo: shopProfile.businessInfo
          },
          [`user_${user.uid}`]: {
            uid: user.uid,
            shopName: user.opticalName || user.displayName || 'Unknown Shop',
            address: { city: user.city || 'Unknown City' }
          },
          [`user_${shopProfile.uid}`]: {
            uid: shopProfile.uid,
            shopName: shopProfile.shopName || shopProfile.displayName,
            address: shopProfile.address
          }
        };

        await setDoc(doc(db, 'chats', chatId), chatData);
        
        const newChat = {
          id: chatId,
          otherUserId: shopProfile.uid,
          shopInfo: {
            shopName: shopProfile.shopName || shopProfile.displayName,
            address: shopProfile.address
          },
          createdAt: new Date(),
          lastMessage: initialMessage || 'Chat started',
          lastMessageTime: new Date()
        };
        
        setActiveChats(prev => [newChat, ...prev]);
        setupMessageListener(chatId);

        if (initialMessage) {
          await sendMessageToFirebase(chatId, initialMessage);
        } else {
          await sendMessageToFirebase(chatId, `${user.opticalName || user.displayName || 'User'} started a chat`, 'system');
        }
      }
      
      setCurrentChatId(chatId);
      setShowSearch(false);
      setSearchTerm('');
      setSearchResults([]);
      
      toast.success(`Chat started with ${shopProfile.shopName || shopProfile.displayName}`);
      
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentChatId) return;

    try {
      await sendMessageToFirebase(currentChatId, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  const handlePrescriptionChange = (e) => {
    const { name, value } = e.target;
    setPrescriptionData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const sendPrescriptionAttachment = async () => {
    if (!currentChatId) return;

    try {
      // Create a user-friendly prescription summary
      const rightEye = `R: ${prescriptionData.rightSph || 'N/A'}/${prescriptionData.rightCyl || 'N/A'}/${prescriptionData.rightAxis || 'N/A'}${prescriptionData.rightAdd ? ` Add: ${prescriptionData.rightAdd}` : ''}`;
      const leftEye = `L: ${prescriptionData.leftSph || 'N/A'}/${prescriptionData.leftCyl || 'N/A'}/${prescriptionData.leftAxis || 'N/A'}${prescriptionData.leftAdd ? ` Add: ${prescriptionData.leftAdd}` : ''}`;
      
      const prescriptionText = `📋 Lens Prescription\n\n${rightEye}\n${leftEye}\n\nQty: R:${prescriptionData.rightQty || 1} L:${prescriptionData.leftQty || 1}`;

      // Send as regular text message but with prescription type metadata
      await sendMessageToFirebase(currentChatId, prescriptionText, 'user', {
        type: 'prescription',
        data: prescriptionData
      });
      
      // Reset and close
      setPrescriptionData({
        rightSph: '',
        rightCyl: '',
        rightAxis: '',
        rightAdd: '',
        leftSph: '',
        leftCyl: '',
        leftAxis: '',
        leftAdd: '',
        rightQty: '1',
        leftQty: '1'
      });
      setShowPrescriptionModal(false);
      setShowAttachments(false);
      
      toast.success('Prescription sent successfully!');
    } catch (error) {
      console.error('Error sending prescription:', error);
      toast.error('Failed to send prescription. Please try again.');
    }
  };

  const sendMessageToFirebase = async (chatId, messageText, sender = 'user', metadata = null) => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const messageData = {
        text: messageText,
        sender: sender === 'system' ? 'system' : user.uid,
        senderInfo: sender === 'system' ? null : {
          uid: user.uid,
          shopName: user.opticalName || user.displayName || 'Unknown Shop',
          address: { city: user.city || 'Unknown City' }
        },
        timestamp: serverTimestamp(),
        type: sender === 'system' ? 'system' : 'text',
        metadata: metadata
      };

      await addDoc(messagesRef, messageData);

      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp()
      });

      setActiveChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, lastMessage: messageText, lastMessageTime: new Date() }
          : chat
      ));

    } catch (error) {
      console.error('Error sending message to Firebase:', error);
      throw error;
    }
  };

  const closeChat = (chatId) => {
    setActiveChats(prev => prev.filter(chat => chat.id !== chatId));
    
    if (messageListeners[chatId]) {
      messageListeners[chatId]();
      setMessageListeners(prev => {
        const newListeners = { ...prev };
        delete newListeners[chatId];
        return newListeners;
      });
    }
    
    setChatMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[chatId];
      return newMessages;
    });
    
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
  };

  const resetAllChats = async () => {
    if (!user?.uid) return;
    
    try {
      // Close all active listeners first
      Object.values(messageListeners).forEach(unsubscribe => unsubscribe());
      
      // Get all chat documents where user is a participant
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises = [];
      
      querySnapshot.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        const participants = chatData.participants || [];
        
        if (participants.length <= 2) {
          // If it's a 1-on-1 chat, delete the entire chat document
          deletePromises.push(deleteDoc(doc(db, 'chats', chatDoc.id)));
        } else {
          // If it's a group chat, just remove the user from participants
          const updatedParticipants = participants.filter(p => p !== user.uid);
          deletePromises.push(
            updateDoc(doc(db, 'chats', chatDoc.id), {
              participants: updatedParticipants,
              [`user_${user.uid}`]: null // Remove user info
            })
          );
        }
      });
      
      await Promise.all(deletePromises);
      
      // Reset all local states
      setActiveChats([]);
      setChatMessages({});
      setMessageListeners({});
      setCurrentChatId(null);
      setUnreadMessages(0);
      setShowNotification(false);
      
      toast.success('All chats cleared successfully!');
    } catch (error) {
      console.error('Error clearing chats:', error);
      toast.error('Failed to clear chats. Please try again.');
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const currentChat = activeChats.find(chat => chat.id === currentChatId);
  const currentMessages = chatMessages[currentChatId] || [];

  // Expose function to be called from other components
  window.startMarketplaceChat = (shopProfile, initialMessage) => {
    setIsExpanded(true);
    startChat(shopProfile, initialMessage);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isExpanded ? (
        /* Minimalistic Chat Button */
        <button
          onClick={() => setIsExpanded(true)}
          className="group bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 relative"
        >
          <svg className="w-6 h-6 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          {unreadMessages > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
              {unreadMessages}
            </span>
          )}
        </button>
      ) : (
        /* Modern Chat Window */
        <div className="w-96 h-[32rem] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden backdrop-blur-lg">
          {/* Gradient Header - Made smaller */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">
                  {currentChat ? currentChat.shopInfo.shopName : 'Marketplace Chat'}
                </h3>
                {currentChat && currentChat.shopInfo.address?.city && (
                  <p className="text-xs text-blue-100">{currentChat.shopInfo.address.city}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {/* Back button - only show when in a chat */}
              {currentChat && (
                <button
                  onClick={() => setCurrentChatId(null)}
                  className="text-white hover:text-gray-200 p-1.5 rounded-lg transition-colors bg-white/20 hover:bg-white/30 border border-white/30"
                  title="Back to chat list"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {/* Minimize button - always visible with clear styling */}
              <button
                onClick={() => setIsExpanded(false)}
                className="text-white hover:text-gray-200 p-1.5 rounded-lg transition-colors bg-white/20 hover:bg-white/30 border border-white/30"
                title="Minimize chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                </svg>
              </button>
              {/* Close button - always visible with clear styling */}
              <button
                onClick={() => {
                  setIsExpanded(false);
                  setCurrentChatId(null);
                  setActiveChats([]);
                }}
                className="text-white hover:text-gray-200 p-1.5 rounded-lg transition-colors bg-white/20 hover:bg-white/30 border border-white/30"
                title="Close and clear all chats"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-800 min-h-0">
            {!currentChat ? (
              /* Chat List / Search */
              <div className="flex-1 flex flex-col">
                {/* Search Section */}
                <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (e.target.value.trim()) {
                          searchShops();
                        } else {
                          setSearchResults([]);
                        }
                      }}
                      placeholder="Search shops by name..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-all"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {searching ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      ) : (
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {activeChats.length > 0 && (
                    <button
                      onClick={resetAllChats}
                      className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Clear All Chats</span>
                    </button>
                  )}
                </div>

                {/* Search Results or Active Chats */}
                <div className="flex-1 overflow-y-auto">
                  {searchTerm.trim() && searchResults.length > 0 ? (
                    /* Search Results */
                    <div className="p-2 space-y-2">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 mb-2">Search Results</h4>
                      {searchResults.map((shop) => (
                        <div
                          key={shop.id}
                          onClick={() => startChat(shop)}
                          className="p-3 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 rounded-xl cursor-pointer transition-all duration-200 border border-gray-100 dark:border-gray-600 hover:border-blue-200 dark:hover:border-gray-500"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {(shop.shopName || shop.displayName || 'S').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-gray-900 dark:text-white truncate">
                                {shop.shopName || shop.displayName}
                              </h5>
                              {shop.address?.city && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {shop.address.city}{shop.address.state && `, ${shop.address.state}`}
                                </p>
                              )}
                              {shop.businessInfo?.businessType && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  {shop.businessInfo.businessType}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeChats.length === 0 ? (
                    /* Empty State */
                    <div className="flex-1 flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Start Chatting</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Search for shops to start a conversation</p>
                      </div>
                    </div>
                  ) : (
                    /* Active Chats */
                    <div className="p-2 space-y-2">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 mb-2">Recent Chats</h4>
                      {activeChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => setCurrentChatId(chat.id)}
                          className="p-3 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 rounded-xl cursor-pointer transition-all duration-200 border border-gray-100 dark:border-gray-600 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {(chat.shopInfo.shopName || 'S').charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-gray-900 dark:text-white truncate">
                                  {chat.shopInfo.shopName}
                                </h5>
                                <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                  {chat.lastMessage}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatTime(chat.lastMessageTime)}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                closeChat(chat.id);
                              }}
                              className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Chat View */
              <>
                {/* Messages */}
                <div 
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0"
                  style={{ maxHeight: 'calc(100% - 140px)' }}
                >
                  {currentMessages.map((message) => {
                    const isMyMessage = message.sender === user.uid;
                    const isSystemMessage = message.type === 'system';
                    
                    // Check if message has prescription metadata
                    const isPrescriptionMessage = message.metadata?.type === 'prescription';
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                            isSystemMessage
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs mx-auto'
                              : isMyMessage
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                              : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {!isSystemMessage && !isMyMessage && (
                            <p className="text-xs opacity-75 mb-1">
                              {message.senderInfo?.shopName || 'Unknown'}
                            </p>
                          )}
                          
                          {isPrescriptionMessage ? (
                            /* Enhanced Prescription Display */
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="font-medium text-xs">Lens Prescription</span>
                              </div>
                              <div className="text-xs whitespace-pre-line">
                                {message.text.replace('📋 Lens Prescription\n\n', '')}
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-line">{message.text}</p>
                          )}
                          
                          <p className={`text-xs mt-1 ${
                            isMyMessage ? 'text-blue-100' : isSystemMessage ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input - Fixed at bottom */}
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                  {/* Attachment Dropdown */}
                  {showAttachments && (
                    <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Attachments</div>
                      <button
                        onClick={() => {
                          setShowPrescriptionModal(true);
                          setShowAttachments(false); // Close attachments when opening modal
                        }}
                        className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors text-sm w-full"
                      >
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300">Lens Prescription</span>
                      </button>
                    </div>
                  )}
                  
                  <div className="flex space-x-2 items-end">
                    <button
                      onClick={() => setShowAttachments(!showAttachments)}
                      className="text-gray-500 hover:text-blue-500 p-2 rounded-full transition-colors"
                      title="Add attachment"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white text-sm resize-none"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-full transition-all duration-200 transform hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Prescription Modal */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add Lens Prescription</h3>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="text-white hover:text-gray-200 p-1 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <LensPrescription
                formData={prescriptionData}
                onChange={handlePrescriptionChange}
                matchingLenses={[]}
                shopMatchingLenses={[]}
                shopLoading={false}
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendPrescriptionAttachment}
                disabled={!prescriptionData.rightSph && !prescriptionData.leftSph}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
              >
                Send Prescription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceChat; 
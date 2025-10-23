"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  MagnifyingGlassIcon, 
  PaperAirplaneIcon, 
  PaperClipIcon, 
  FaceSmileIcon,
  PhoneIcon,
  VideoCameraIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

type Contact = {
  id: string;
  name: string;
  role: string; // 'teacher', 'student', 'admin'
  avatar: string;
  online: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unread: number;
};

type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
  files?: {
    name: string;
    type: string;
    size: number;
    url: string;
  }[];
};

export default function MessagePage() {
  const [contacts, setContacts] = useState<Contact[]>([
    { 
      id: '1', 
      name: 'Lê Thanh Tùng', 
      role: 'teacher', 
      avatar: '/avatars/teacher-1.png', 
      online: true, 
      lastMessage: 'Nhớ nộp bài tập về nhà vào thứ 6 nhé!',
      lastMessageTime: '10:23 AM',
      unread: 2
    },
    { 
      id: '2', 
      name: 'Nguyễn Thị Mai', 
      role: 'teacher', 
      avatar: '/avatars/teacher-2.png', 
      online: false,
      lastMessage: 'Buổi học tiếp theo sẽ có bài kiểm tra',
      lastMessageTime: 'Hôm qua',
      unread: 0
    },
    { 
      id: '3', 
      name: 'Trần Văn An', 
      role: 'student', 
      avatar: '/avatars/student-1.png', 
      online: true,
      lastMessage: 'Bạn đã xem tài liệu môn toán chưa?',
      lastMessageTime: 'Hôm qua',
      unread: 0
    },
    { 
      id: '4', 
      name: 'Phạm Minh Tuấn', 
      role: 'student', 
      avatar: '/avatars/student-2.png', 
      online: true,
      lastMessage: 'Mình gửi bạn bài giải rồi đó',
      lastMessageTime: 'Thứ 2',
      unread: 0
    },
    { 
      id: '5', 
      name: 'Hỗ trợ Kỹ thuật', 
      role: 'admin', 
      avatar: '/avatars/admin.png', 
      online: true,
      lastMessage: 'Chúng tôi đã xử lý yêu cầu của bạn',
      lastMessageTime: '08/10',
      unread: 1
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'teachers'>('all');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Load messages when a contact is selected
    if (selectedContact) {
      // In a real application, you would fetch messages from an API
      const mockMessages: Message[] = [
        {
          id: '1',
          senderId: selectedContact.id,
          text: 'Chào bạn, mình có thể giúp gì cho bạn?',
          timestamp: '10:00 AM',
          read: true
        },
        {
          id: '2',
          senderId: 'me',
          text: 'Chào thầy, em có thắc mắc về bài tập tuần trước ạ.',
          timestamp: '10:05 AM',
          read: true
        },
        {
          id: '3',
          senderId: selectedContact.id,
          text: 'Bạn có thể nói cụ thể hơn về phần nào bạn chưa hiểu không?',
          timestamp: '10:07 AM',
          read: true
        },
        {
          id: '4',
          senderId: 'me',
          text: 'Em chưa hiểu cách giải bài toán về phương trình bậc hai ạ. Phần tìm nghiệm phức.',
          timestamp: '10:10 AM',
          read: true
        },
        {
          id: '5',
          senderId: selectedContact.id,
          text: 'OK, tôi hiểu rồi. Đối với phương trình bậc hai, khi delta < 0, ta có nghiệm phức. Công thức tổng quát là: x = (-b ± √Δ.i)/2a, với Δ = b² - 4ac và i là đơn vị ảo.',
          timestamp: '10:15 AM',
          read: true
        },
        {
          id: '6',
          senderId: selectedContact.id,
          text: 'Tôi sẽ gửi cho bạn một tài liệu giải thích chi tiết hơn.',
          timestamp: '10:16 AM',
          read: true,
          files: [
            {
              name: 'phuong-trinh-bac-hai.pdf',
              type: 'pdf',
              size: 2500000,
              url: '/documents/phuong-trinh-bac-hai.pdf'
            }
          ]
        },
        {
          id: '7',
          senderId: 'me',
          text: 'Cảm ơn thầy nhiều ạ. Em sẽ đọc tài liệu này.',
          timestamp: '10:20 AM',
          read: true
        },
        {
          id: '8',
          senderId: selectedContact.id,
          text: 'Không có gì. Nếu bạn có thêm câu hỏi, hãy liên hệ với tôi nhé.',
          timestamp: '10:22 AM',
          read: true
        },
        {
          id: '9',
          senderId: selectedContact.id,
          text: 'Nhớ nộp bài tập về nhà vào thứ 6 nhé!',
          timestamp: '10:23 AM',
          read: false
        }
      ];

      setMessages(mockMessages);
    }
  }, [selectedContact]);

  const filteredContacts = contacts.filter(contact => {
    // Apply search filter
    if (searchQuery && !contact.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Apply type filter
    if (chatFilter === 'unread' && contact.unread === 0) {
      return false;
    }

    if (chatFilter === 'teachers' && contact.role !== 'teacher') {
      return false;
    }

    return true;
  });

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    
    // Mark messages as read
    if (contact.unread > 0) {
      setContacts(prevContacts => 
        prevContacts.map(c => c.id === contact.id ? {...c, unread: 0} : c)
      );
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() === '' || !selectedContact) return;
    
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      text: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true
    };
    
    setMessages([...messages, newMsg]);
    setNewMessage('');
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !selectedContact) return;
    
    // In a real app, you would upload these files to a server
    // For this demo, we'll just create a message with the file
    const fileArray = Array.from(files).map(file => ({
      name: file.name,
      type: file.type.split('/')[1],
      size: file.size,
      url: URL.createObjectURL(file)
    }));
    
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: 'me',
      text: 'Đã gửi tệp đính kèm',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true,
      files: fileArray
    };
    
    setMessages([...messages, newMsg]);
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const emojis = ['😊', '😂', '❤️', '👍', '🎉', '🤔', '😢', '😎', '🙏', '👋'];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getRoleText = (role: string) => {
    switch(role) {
      case 'teacher': return 'Giáo viên';
      case 'student': return 'Học sinh';
      case 'admin': return 'Quản trị viên';
      default: return '';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'teacher': return 'bg-blue-100 text-blue-800';
      case 'student': return 'bg-green-100 text-green-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-full w-full bg-white overflow-hidden rounded-xl shadow-sm max-w-full">
      {/* Contact Sidebar - Fixed header with scrollable contact list */}
      <div className="w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 flex flex-col md:min-w-[250px] md:max-w-[350px]">
        {/* Fixed header */}
        <div className="px-5 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-semibold text-gray-800">Tin nhắn</h1>
          
          <div className="mt-4 relative">
            <input
              type="text"
              placeholder="Tìm kiếm liên hệ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#161853] focus:border-transparent transition-colors"
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          </div>
          
          <div className="flex space-x-2 mt-4">
            <button
              onClick={() => setChatFilter('all')}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                chatFilter === 'all' ? 'bg-[#161853] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setChatFilter('unread')}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                chatFilter === 'unread' ? 'bg-[#161853] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Chưa đọc
            </button>
            <button
              onClick={() => setChatFilter('teachers')}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                chatFilter === 'teachers' ? 'bg-[#161853] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Giáo viên
            </button>
          </div>
        </div>
        
        {/* Scrollable contact list */}
        <div className="divide-y divide-gray-200 flex-1 overflow-y-auto">
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactSelect(contact)}
                className={`px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedContact?.id === contact.id ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {/* Placeholder for avatar */}
                      {contact.avatar ? (
                        <Image 
                          src={contact.avatar} 
                          alt={contact.name}
                          width={48}
                          height={48}
                          className="rounded-full"
                        />
                      ) : (
                        <span className="text-xl text-gray-600">{contact.name.charAt(0)}</span>
                      )}
                    </div>
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></span>
                    )}
                  </div>
                  
                  <div className="ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium text-gray-900">{contact.name}</h2>
                      <span className="text-xs text-gray-500">{contact.lastMessageTime}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-500 line-clamp-1">{contact.lastMessage}</p>
                      {contact.unread > 0 && (
                        <span className="bg-[#161853] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(contact.role)}`}>
                        {getRoleText(contact.role)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 px-5 text-center text-gray-500">
              <div className="rounded-full bg-gray-100 h-12 w-12 flex items-center justify-center mx-auto mb-3">
                <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
              </div>
              Không tìm thấy kết quả phù hợp
            </div>
          )}
        </div>
      </div>
      
      {/* Chat Window */}
      <div className="hidden md:flex flex-col flex-1 relative overflow-hidden max-w-full">
        {selectedContact ? (
          <>
            {/* Chat Header - Fixed at top */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
              <div className="flex items-center">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                    {selectedContact.avatar ? (
                      <Image 
                        src={selectedContact.avatar} 
                        alt={selectedContact.name}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <span className="text-lg text-gray-600">{selectedContact.name.charAt(0)}</span>
                    )}
                  </div>
                  {selectedContact.online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                
                <div className="ml-3">
                  <h2 className="text-sm font-medium text-gray-900">{selectedContact.name}</h2>
                  <p className="text-xs text-gray-500">
                    {selectedContact.online ? 'Đang hoạt động' : 'Không hoạt động'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="Gọi điện">
                  <PhoneIcon className="h-5 w-5 text-gray-500" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="Gọi video">
                  <VideoCameraIcon className="h-5 w-5 text-gray-500" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="Thông tin">
                  <InformationCircleIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            
              {/* Main chat layout - Using Flex + fixed positioning for optimal layout */}
            <div className="flex flex-col h-full relative"> {/* Relative positioning for children */}
              {/* Messages - Only this area should scroll */}
              <div className="flex-1 px-5 py-5 pb-24 overflow-y-auto bg-gray-50"> {/* Reduced bottom padding */}
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] md:max-w-[70%] rounded-lg px-4 py-3 shadow-sm ${
                          message.senderId === 'me'
                            ? 'bg-[#161853] text-white'
                            : 'bg-white border border-gray-200 text-gray-800'
                        }`}
                      >
                        <p>{message.text}</p>
                        
                        {message.files && message.files.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.files.map((file, index) => (
                              <a
                                key={index}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center p-2 rounded ${
                                  message.senderId === 'me'
                                    ? 'bg-[#0e1035] hover:bg-[#0a0c29]'
                                    : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                              >
                                <div className="h-8 w-8 flex items-center justify-center bg-white rounded">
                                  <span className="text-xs font-medium uppercase text-[#161853]">
                                    {file.type}
                                  </span>
                                </div>
                                <div className="ml-2 flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${message.senderId === 'me' ? 'text-white' : 'text-gray-900'}`}>
                                    {file.name}
                                  </p>
                                  <p className={`text-xs ${message.senderId === 'me' ? 'text-blue-200' : 'text-gray-500'}`}>
                                    {formatFileSize(file.size)}
                                  </p>
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                        
                        <div
                          className={`mt-2 text-xs ${
                            message.senderId === 'me' ? 'text-blue-200 text-right' : 'text-gray-500'
                          }`}
                        >
                          {message.timestamp}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            
              {/* Message Input - Fixed at bottom with absolute positioning */}
              <div className="absolute bottom-0 left-0 right-0 px-5 py-3 border-t border-gray-200 bg-white z-50 shadow-lg max-w-full">
                <div className="flex flex-row items-center gap-2 max-w-full">
                  {/* Text Input Area */}
                  <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-[#161853] focus-within:border-transparent bg-white min-w-0">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Nhập tin nhắn..."
                      className="flex-1 border-none outline-none resize-none bg-transparent min-w-0"
                      rows={1}
                    />
                    
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                      title="Emoji"
                    >
                      <FaceSmileIcon className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                  
                  {/* Action Buttons */}
                  <button
                    onClick={handleFileUpload}
                    className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
                    title="Đính kèm tệp"
                  >
                    <PaperClipIcon className="h-5 w-5 text-gray-500" />
                  </button>
                  
                  <button
                    onClick={handleSendMessage}
                    className="p-2.5 rounded-full bg-[#161853] hover:bg-[#0a0c29] text-white transition-colors shadow-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Gửi"
                    disabled={newMessage.trim() === ''}
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                  />
                </div>
                
                {/* Emoji Picker Popup */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-5 mb-2 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleEmojiClick(emoji)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gray-50">
            <div className="p-10 text-center">
              <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-[#161853]/10 flex items-center justify-center shadow-inner">
                <PaperAirplaneIcon className="h-12 w-12 text-[#161853]" />
              </div>
              <h2 className="text-2xl font-medium text-gray-700 mb-2">Tin nhắn của bạn</h2>
              <p className="mt-3 text-gray-500 max-w-xs mx-auto">Chọn một liên hệ để bắt đầu cuộc trò chuyện</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: No Contact Selected View */}
      <div className="flex md:hidden flex-col items-center justify-center h-full w-full bg-gray-50">
        <div className="p-8 text-center">
          <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-[#161853]/10 flex items-center justify-center">
            <PaperAirplaneIcon className="h-10 w-10 text-[#161853]" />
          </div>
          <h2 className="text-xl font-medium text-gray-700">Tin nhắn của bạn</h2>
          <p className="mt-2 text-gray-500">Vui lòng sử dụng thiết bị có màn hình lớn hơn để trải nghiệm tốt nhất</p>
        </div>
      </div>
    </div>
  );
}

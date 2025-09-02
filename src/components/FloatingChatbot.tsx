import { useState } from "react";
import { MessageCircle, X, Minimize2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export default function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m your Finshield assistant. How can I help you with credit risk analysis today?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  const getHardcodedResponse = (userText: string): string | null => {
    const lowerText = userText.toLowerCase();
    
    if (lowerText.includes("default probability is high") && lowerText.includes("what can i do")) {
      return "When a user's default probability is high, consider these actions:\n\n1. Request additional verification documents\n2. Offer a lower credit limit initially\n3. Require a co-signer or guarantor\n4. Implement stricter monitoring and payment reminders\n5. Consider alternative payment plans or shorter loan terms\n6. Evaluate if manual underwriting review is needed\n\nYou can also check their recent transaction patterns and employment stability for more context.";
    }
    
    if (lowerText.includes("employment_type") && lowerText.includes("mean")) {
      return "The 'employment_type' field indicates the user's job category, which is crucial for credit risk assessment:\n\n• **Salaried**: Regular monthly income, generally lower risk\n• **Self-employed**: Variable income, higher risk due to income fluctuation\n• **Business Owner**: Income depends on business performance, moderate to high risk\n• **Freelancer**: Irregular income pattern, higher risk\n• **Unemployed**: No steady income, highest risk\n• **Retired**: Fixed pension/savings, low to moderate risk\n\nThis field helps predict payment consistency and default probability based on income stability.";
    }
    
    return null;
  };

  const sendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');

    // Check for hardcoded responses first
    const hardcodedResponse = getHardcodedResponse(currentInput);
    
    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: hardcodedResponse || 'Thank you for your question. I can help you with credit risk analysis questions. Try asking about high default probability actions or field meanings!',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-primary hover:bg-primary/90 z-50"
          size="icon"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      )}

      {/* Chatbot Screen */}
      {isOpen && (
        <Card 
          className={`fixed bottom-6 right-6 w-80 shadow-2xl border-0 bg-background z-50 transition-all duration-300 ${
            isMinimized ? 'h-14' : 'h-96'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-medium">CreditWise Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content - Hidden when minimized */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-4 h-64">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg text-sm ${
                          message.sender === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="flex gap-2 p-4 border-t">
                <Input
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button 
                  onClick={sendMessage}
                  size="icon"
                  disabled={!inputValue.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
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
    
    // High default probability actions
    if (lowerText.includes("default probability is high") && lowerText.includes("what can i do")) {
      return "When a user's default probability is high, consider these actions:\n\n1. Request additional verification documents\n2. Offer a lower credit limit initially\n3. Require a co-signer or guarantor\n4. Implement stricter monitoring and payment reminders\n5. Consider alternative payment plans or shorter loan terms\n6. Evaluate if manual underwriting review is needed\n\nYou can also check their recent transaction patterns and employment stability for more context.";
    }
    
    // Employment type explanation
    if (lowerText.includes("employment_type") && lowerText.includes("mean")) {
      return "The 'employment_type' field indicates the user's job category, which is crucial for credit risk assessment:\n\n• **Salaried**: Regular monthly income, generally lower risk\n• **Self-employed**: Variable income, higher risk due to income fluctuation\n• **Business Owner**: Income depends on business performance, moderate to high risk\n• **Freelancer**: Irregular income pattern, higher risk\n• **Unemployed**: No steady income, highest risk\n• **Retired**: Fixed pension/savings, low to moderate risk\n\nThis field helps predict payment consistency and default probability based on income stability.";
    }
    
    // How the system works
    if (lowerText.includes("how") && (lowerText.includes("work") || lowerText.includes("system"))) {
      return "Finshield Credit Risk Engine works by:\n\n1. **Data Upload**: Upload CSV with user behavioral data\n2. **Signal Analysis**: Analyzes payment delays, cart abandonment, geo-variance, SMS patterns\n3. **Risk Scoring**: Computes Probability of Default (PD) using machine learning algorithms\n4. **Risk Categories**: Classifies users as Low (<30%), Medium (30-60%), or High Risk (>60%)\n5. **Individual Assessment**: Enter specific user details for personalized risk analysis\n\nThe system uses alternative data sources like SMS patterns and behavioral signals for more accurate risk assessment.";
    }
    
    // What data is needed
    if (lowerText.includes("what data") || lowerText.includes("data needed") || lowerText.includes("csv format")) {
      return "For optimal risk analysis, your CSV should include:\n\n**Required Fields:**\n• user_id - Unique identifier\n• payment_delay_ratio - Payment delay frequency\n• avg_recharge_amt - Average recharge amount\n• cart_abandonment_rate - Shopping cart abandonment rate\n• geo_variance_score - Location variance score\n• months_active - User tenure\n\n**Additional Fields:**\n• age, location, employment_type\n• sms_bank_count, sms_otp_count, sms_upi_count\n• avg_order_value, recharge_freq\n\nMore data points improve prediction accuracy!";
    }
    
    // Risk score interpretation
    if (lowerText.includes("risk score") || lowerText.includes("pd score") || lowerText.includes("interpret")) {
      return "**Risk Score Interpretation:**\n\n🟢 **Low Risk (0-30%)**: Safe to lend, minimal monitoring needed\n🟡 **Medium Risk (30-60%)**: Moderate caution, regular monitoring recommended\n🔴 **High Risk (60%+)**: High default probability, strict controls needed\n\n**Key Factors:**\n• Payment delay ratio (highest impact)\n• Cart abandonment rate\n• Geo-variance score\n• Income stability (employment type)\n• Transaction patterns (SMS data)\n\nScores are updated in real-time as new data becomes available.";
    }
    
    // Demo data explanation
    if (lowerText.includes("demo") || lowerText.includes("example") || lowerText.includes("test data")) {
      return "**Demo Data Includes:**\n\n• 3 sample users with different risk profiles\n• User U-1024: Low risk (18 months active, stable patterns)\n• User U-2048: Medium risk (7 months active, moderate signals)\n• User U-4096: High risk (3 months active, concerning patterns)\n\nYou can load demo data to explore features before uploading your own CSV. The demo shows how different behavioral patterns affect risk scores.";
    }
    
    // SMS data importance
    if (lowerText.includes("sms") && (lowerText.includes("important") || lowerText.includes("why") || lowerText.includes("use"))) {
      return "**SMS Data Importance for Credit Risk:**\n\n• **Bank SMS**: Indicates financial activity and account health\n• **OTP SMS**: Shows digital engagement and transaction frequency\n• **UPI SMS**: Reflects payment behavior and digital wallet usage\n• **Promotional SMS**: Suggests spending patterns and brand loyalty\n\nSMS patterns reveal behavioral insights that traditional credit scoring misses, making risk assessment more accurate for thin-file borrowers.";
    }
    
    // Export/download functionality
    if (lowerText.includes("download") || lowerText.includes("export") || lowerText.includes("excel")) {
      return "**Export Features:**\n\n• Download results as Excel file with computed risk scores\n• Includes original data plus prediction_proba and pd_score columns\n• File naming: risk_analysis_YYYY-MM-DD.xlsx\n• All analyzed users included with their risk assessments\n\nPerfect for sharing results with your team or importing into other systems for decision making.";
    }
    
    // Individual assessment
    if (lowerText.includes("individual") && lowerText.includes("assessment")) {
      return "**Individual Risk Assessment:**\n\n• Enter user details manually without uploading CSV\n• System checks if user exists in uploaded data first\n• If not found, creates new assessment with provided details\n• Shows comprehensive risk breakdown including SMS activity\n• Perfect for real-time assessments during loan applications\n\nUse this for quick risk checks on potential borrowers.";
    }
    
    // General help
    if (lowerText.includes("help") || lowerText.includes("features") || lowerText.includes("what can")) {
      return "**Finshield Features:**\n\n📊 **Bulk Analysis**: Upload CSV for batch risk assessment\n👤 **Individual Assessment**: Analyze single users in real-time\n📈 **Risk Visualization**: Interactive charts and speedometers\n📄 **Export Results**: Download Excel with risk scores\n🎯 **Demo Mode**: Test with sample data\n💬 **Smart Chat**: Get instant help and insights\n\nAsk me about specific features, data requirements, or risk interpretation!";
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
        text: hardcodedResponse || 'I can help you with Finshield credit risk analysis! Try asking about:\n\n• How the system works\n• Data requirements\n• Risk score interpretation\n• SMS data importance\n• Export features\n• Individual assessments\n\nWhat would you like to know?',
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
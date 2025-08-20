import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Mail, Send, Eye, Download, Copy } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface EventData {
  title: string;
  date: string;
  time: string;
  location?: string;
  description?: string;
  organizer?: string;
}

const EmailInvite: React.FC = () => {
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    organizer: ''
  });
  
  const [recipientEmail, setRecipientEmail] = useState('');
  const [invitePreview, setInvitePreview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const { toast } = useToast();

  const generatePreview = async () => {
    if (!eventData.title || !eventData.date || !eventData.time) {
      toast({
        title: "Dados incompletos",
        description: "Preencha pelo menos título, data e horário",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/email/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      if (response.ok) {
        const preview = await response.json();
        setInvitePreview(preview);
        setShowPreview(true);
        toast({
          title: "Preview gerado",
          description: "Convite criado com sucesso!"
        });
      } else {
        throw new Error('Erro ao gerar preview');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível gerar o preview",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateMailtoLink = async () => {
    if (!eventData.title || !eventData.date || !eventData.time) {
      toast({
        title: "Dados incompletos",
        description: "Preencha pelo menos título, data e horário",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/email/mailto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventData,
          recipientEmail
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Abrir o cliente de email
        window.open(result.mailtoLink, '_self');
        
        toast({
          title: "Email aberto!",
          description: "Seu cliente de email foi aberto com o convite pronto"
        });
      } else {
        throw new Error('Erro ao gerar link');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o email",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (invitePreview?.html) {
      navigator.clipboard.writeText(invitePreview.html);
      toast({
        title: "Copiado!",
        description: "HTML do convite copiado para a área de transferência"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📧 Gerador de Convites
          </h1>
          <p className="text-gray-600">
            Crie convites profissionais e envie por email
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Dados do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Título do Evento *</Label>
                <Input
                  id="title"
                  value={eventData.title}
                  onChange={(e) => setEventData({...eventData, title: e.target.value})}
                  placeholder="Ex: Reunião de Projeto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={eventData.date}
                    onChange={(e) => setEventData({...eventData, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="time">Horário *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={eventData.time}
                    onChange={(e) => setEventData({...eventData, time: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="location">Local</Label>
                <Input
                  id="location"
                  value={eventData.location}
                  onChange={(e) => setEventData({...eventData, location: e.target.value})}
                  placeholder="Ex: Sala de Reuniões 3"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={eventData.description}
                  onChange={(e) => setEventData({...eventData, description: e.target.value})}
                  placeholder="Detalhes sobre o evento..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="organizer">Organizador</Label>
                <Input
                  id="organizer"
                  value={eventData.organizer}
                  onChange={(e) => setEventData({...eventData, organizer: e.target.value})}
                  placeholder="Seu nome"
                />
              </div>

              <Separator />

              <div>
                <Label htmlFor="email">Email do Destinatário (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="exemplo@email.com (deixe vazio para preencher depois)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  💡 Funciona como os links de calendário - sem necessidade de configuração!
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={generatePreview}
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Gerar Preview
                </Button>
                
                <Button 
                  onClick={generateMailtoLink}
                  disabled={isLoading}
                  variant="default"
                  className="flex-1"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Abrir Email
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview do Convite
                </span>
                {invitePreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar HTML
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showPreview && invitePreview ? (
                <div className="space-y-4">
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Assunto:</h3>
                    <p className="text-sm text-gray-600">{invitePreview.subject}</p>
                  </div>
                  
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Preview:</h3>
                    <div 
                      className="text-sm"
                      dangerouslySetInnerHTML={{ __html: invitePreview.html }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Preencha os dados e clique em "Gerar Preview"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmailInvite; 
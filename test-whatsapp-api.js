/**
 * Script para testar a API do WhatsApp
 */

const BASE_URL = 'http://localhost:3002';

function makeRequest(path, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    return fetch(`${BASE_URL}${path}`, options)
        .then(response => response.json())
        .catch(error => ({ error: error.message }));
}

async function testWhatsAppAPI() {
    console.log('🧪 Testando API WhatsApp Baileys');
    
    // Teste 1: Status
    console.log('\n1. Verificando status...');
    const status = await makeRequest('/status');
    console.log('Status:', status);
    
    // Teste 2: QR Code
    if (!status.connected) {
        console.log('\n2. Obtendo QR Code...');
        const qr = await makeRequest('/qr');
        console.log('QR disponível:', !!qr.qr);
    }
    
    // Teste 3: Envio (apenas se conectado)
    if (status.connected) {
        console.log('\n3. Testando envio de mensagem...');
        const send = await makeRequest('/send-message', 'POST', {
            number: '5511999999999',
            message: 'Teste do Zelar Bot - mensagem automática'
        });
        console.log('Resultado:', send);
    }
    
    console.log('\n✅ Teste completo!');
    if (!status.connected) {
        console.log('💡 Escaneie o QR Code para ativar todas as funcionalidades');
    }
}

testWhatsAppAPI();
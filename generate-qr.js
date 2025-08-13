import qrcode from 'qrcode-terminal';

// Gerar QR code para o servidor local
const localData = "http://localhost:8080/api/whatsapp/qr";

console.log("🔗 QR Code para conectar no WhatsApp (Servidor Local):");
console.log("Escaneie este QR code para conectar no WhatsApp:");

qrcode.generate(localData, { small: true });

console.log("\n📱 Ou acesse diretamente:");
console.log(localData);
console.log("\n📋 Como conectar:");
console.log("1. Abra o WhatsApp no seu celular");
console.log("2. Toque em Menu (3 pontos) → Dispositivos conectados");
console.log("3. Toque em Conectar dispositivo");
console.log("4. Aponte a câmera para o QR code acima");
console.log("\n⚠️  Certifique-se de que o servidor está rodando em localhost:8080"); 
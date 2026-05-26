import { createHash } from "node:crypto";
import { storage } from "../../storage";
import { extractTextFromImage } from "../imageOCR";
import { parseReceiptFromOcrText } from "./receiptTextParser";
import {
  resolvePaymentDedupeKeyFromReceiptText,
  resolvePaymentDedupeKeyFromUploadFile,
} from "./pixDedupeKey";
import { applyIncomingCreditToContact } from "./applyIncomingCredit";
import type { PluggyTx } from "../pluggy/pluggyPaymentProcessor";
import {
  buildCreditSearchBlob,
  resolvePluggyCreditContact,
} from "../pluggy/pluggyPaymentProcessor";

export type ReceiptUploadResult = {
  ok: boolean;
  status: "duplicate" | "matched" | "no_match" | "unreadable" | "not_credit";
  dedupeKey?: string;
  contactId?: number;
  markedLessons?: number;
  amountCents?: number;
  payerName?: string | null;
  message: string;
};

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function syntheticTxFromReceipt(parsed: {
  amountCents: number;
  txPostedAt: Date;
  payerName: string | null;
  endToEndId: string | null;
  rawText: string;
  paymentMethod?: "PIX" | "CARD";
}): PluggyTx {
  return {
    id: undefined,
    type: "CREDIT",
    status: "POSTED",
    amount: parsed.amountCents / 100,
    date: parsed.txPostedAt.toISOString(),
    description: parsed.rawText.slice(0, 400),
    descriptionRaw: parsed.rawText.slice(0, 800),
    paymentData: {
      paymentMethod: parsed.paymentMethod || "PIX",
      payer: parsed.payerName ? { name: parsed.payerName } : undefined,
      referenceNumber: parsed.endToEndId ?? undefined,
    },
  };
}

export async function processReceiptUpload(opts: {
  userId: number;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  contextText?: string;
}): Promise<ReceiptUploadResult> {
  const { userId, buffer, mimeType, originalName, contextText } = opts;
  const settings = await storage.getUserSettings(userId);
  const timeZone = settings?.timeZone ?? "America/Sao_Paulo";

  const isImage = /^image\//i.test(mimeType);
  if (!isImage) {
    return {
      ok: false,
      status: "unreadable",
      message:
        "Envie foto ou print do comprovante (JPG, PNG ou WebP). PDF ainda não é suportado — exporte como imagem.",
    };
  }

  const ocrText = await extractTextFromImage(buffer, mimeType);
  if (!ocrText?.trim()) {
    const fileKey = resolvePaymentDedupeKeyFromUploadFile(sha256(buffer), userId);
    if (await storage.hasPluggyContactCredit(userId, fileKey)) {
      return {
        ok: true,
        status: "duplicate",
        dedupeKey: fileKey,
        message: "Este arquivo já foi enviado antes.",
      };
    }
    return {
      ok: false,
      status: "unreadable",
      message:
        "Não foi possível ler o texto da imagem. Use foto nítida ou configure OCR (TESSERACT_PATH / OCR_SERVICE_URL).",
    };
  }

  const parsed = parseReceiptFromOcrText(
    contextText?.trim() ? `${contextText.trim()}\n\n${ocrText}` : ocrText,
    timeZone,
  );
  if (!parsed) {
    return {
      ok: false,
      status: "not_credit",
      message:
        "Não identificamos um recebimento com valor no comprovante. Se for cartão, envie com legenda tipo: `cartão João 50`.",
    };
  }

  let dedupeKey = resolvePaymentDedupeKeyFromReceiptText(ocrText, {
    txPostedAt: parsed.txPostedAt,
    amountCents: parsed.amountCents,
    payerName: parsed.payerName,
    timeZone,
  });

  if (!dedupeKey) {
    dedupeKey = resolvePaymentDedupeKeyFromUploadFile(sha256(buffer), userId);
  }

  if (await storage.hasPluggyContactCredit(userId, dedupeKey)) {
    await storage.insertPaymentReceiptUpload({
      userId,
      dedupeKey,
      contactId: null,
      amountCents: parsed.amountCents,
      originalFilename: originalName.slice(0, 255),
      status: "duplicate",
      detail: "Pagamento já registrado (Pluggy ou comprovante anterior).",
    });
    return {
      ok: true,
      status: "duplicate",
      dedupeKey,
      amountCents: parsed.amountCents,
      payerName: parsed.payerName,
      message: "Este pagamento já foi registrado (mesmo identificador no extrato ou em outro comprovante).",
    };
  }

  const tx = syntheticTxFromReceipt(parsed);
  const amountCents = parsed.amountCents;
  const payerHint = parsed.payerName;
  const memoBlob = buildCreditSearchBlob(tx);

  const resolved = await resolvePluggyCreditContact(
    userId,
    tx,
    amountCents,
    settings,
    memoBlob,
    payerHint,
    null,
  );

  if (!resolved?.contact) {
    await storage.insertPaymentReceiptUpload({
      userId,
      dedupeKey,
      contactId: null,
      amountCents,
      originalFilename: originalName.slice(0, 255),
      status: "no_match",
      detail: `Sem aluno: ${parsed.amountCents / 100} BRL, pagador=${payerHint ?? "?"}`,
    });
    return {
      ok: false,
      status: "no_match",
      dedupeKey,
      amountCents,
      payerName: parsed.payerName,
      message:
        "Valor e pagador lidos, mas nenhum aluno bateu. Confira nome/CPF no cadastro ou envie comprovante com nome completo.",
    };
  }

  const apply = await applyIncomingCreditToContact({
    userId,
    contact: resolved.contact,
    amountCents,
    txPostedAt: parsed.txPostedAt,
    ledgerTxKey: dedupeKey,
    matchKind: resolved.matchKind,
    paymentSource: "upload",
  });

  if (apply.duplicate) {
    await storage.insertPaymentReceiptUpload({
      userId,
      dedupeKey,
      contactId: resolved.contact.id,
      amountCents,
      originalFilename: originalName.slice(0, 255),
      status: "duplicate",
      detail: apply.reason ?? "duplicate",
    });
    return {
      ok: true,
      status: "duplicate",
      dedupeKey,
      contactId: resolved.contact.id,
      amountCents,
      payerName: parsed.payerName,
      message: "Pagamento já estava registrado.",
    };
  }

  if (!apply.applied) {
    await storage.insertPaymentReceiptUpload({
      userId,
      dedupeKey,
      contactId: resolved.contact.id,
      amountCents,
      originalFilename: originalName.slice(0, 255),
      status: "no_match",
      detail: apply.reason ?? "nao_aplicado",
    });
    const msg =
      apply.reason === "data_anterior_aula" ?
        "Data do comprovante é anterior à primeira aula pendente deste aluno."
      : apply.reason === "teto_prepagamento" ?
        "Crédito acima do limite sem aulas cadastradas."
      : "Pagamento não aplicado às regras do Zelar.";
    return {
      ok: false,
      status: "no_match",
      dedupeKey,
      contactId: resolved.contact.id,
      amountCents,
      payerName: parsed.payerName,
      message: msg,
    };
  }

  await storage.insertPaymentReceiptUpload({
    userId,
    dedupeKey,
    contactId: resolved.contact.id,
    amountCents,
    originalFilename: originalName.slice(0, 255),
    status: "matched",
    detail:
      apply.markedLessons > 0 ?
        `${apply.markedLessons} aula(s) quitada(s)`
      : "crédito no saldo retido",
  });

  const msg =
    apply.markedLessons > 0 ?
      `Comprovante aceito: ${apply.markedLessons} aula(s) marcada(s) como paga(s).`
    : "Comprovante aceito: crédito registrado (saldo retido / aguardando aulas pendentes).";

  return {
    ok: true,
    status: "matched",
    dedupeKey,
    contactId: resolved.contact.id,
    markedLessons: apply.markedLessons,
    amountCents,
    payerName: parsed.payerName,
    message: msg,
  };
}

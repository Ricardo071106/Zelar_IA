import { createHash } from "node:crypto";
import { storage } from "../../storage";
import { extractTextFromReceiptDocument, receiptDocumentMimeSupported } from "../documentTextExtract";
import { parseReceiptFromOcrText } from "./receiptTextParser";
import {
  resolvePaymentDedupeKeyFromReceiptText,
  resolvePaymentDedupeKeyFromUploadFile,
} from "./pixDedupeKey";
import { applyIncomingCreditToContact } from "./applyIncomingCredit";
import { syncExistingLedgerCreditToBalance } from "./syncExistingLedgerCredit";
import type { PluggyTx } from "../pluggy/pluggyPaymentProcessor";
import {
  resolvePluggyCreditContact,
} from "../pluggy/pluggyPaymentProcessor";
import { extractPayerNameFromPluggyTransaction } from "../pluggy/pluggyPayerExtract";
import { buildReceiptPayerMemoBlob, parseReceiptPayerName } from "./receiptPayerExtract";
import { displayNameFromGuestContact } from "../pluggy/lessonUnitPrice";
import { normalizeAliasKey } from "../../utils/normalizeGuestAlias";

export type ReceiptUploadResult = {
  ok: boolean;
  status: "duplicate" | "matched" | "no_match" | "unreadable" | "not_credit";
  dedupeKey?: string;
  contactId?: number;
  markedLessons?: number;
  amountCents?: number;
  payerName?: string | null;
  balanceSyncedCents?: number;
  contactStudentName?: string;
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
      paymentMethod: "PIX",
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

  if (!receiptDocumentMimeSupported(mimeType, originalName)) {
    return {
      ok: false,
      status: "unreadable",
      message:
        "Envie comprovante em imagem (JPG, PNG, WebP) ou PDF (até ~12 MB). Outros formatos não são suportados.",
    };
  }

  const ocrText = await extractTextFromReceiptDocument(buffer, mimeType, originalName);
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
        "Não foi possível ler o comprovante. Em PDF, use arquivo com texto selecionável (não só scan). Em imagem, use foto nítida ou OCR (TESSERACT_PATH / OCR_SERVICE_URL).",
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
      message: "Não identificamos um PIX recebido com valor no comprovante.",
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
    const synced = await syncExistingLedgerCreditToBalance(userId, dedupeKey);
    await storage.insertPaymentReceiptUpload({
      userId,
      dedupeKey,
      contactId: synced.contactId,
      amountCents: parsed.amountCents,
      originalFilename: originalName.slice(0, 255),
      status: "duplicate",
      detail:
        synced.contactId != null ?
          `Pagamento já registrado; saldo sincronizado (${synced.balanceCents} centavos).`
        : "Pagamento já registrado (Pluggy ou comprovante anterior).",
    });
    const brl =
      synced.balanceCents > 0 ?
        (synced.balanceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : null;
    return {
      ok: true,
      status: "duplicate",
      dedupeKey,
      contactId: synced.contactId ?? undefined,
      amountCents: parsed.amountCents,
      payerName: parsed.payerName,
      balanceSyncedCents: synced.balanceCents > 0 ? synced.balanceCents : undefined,
      message:
        synced.contactId != null && brl ?
          `Este pagamento já estava registrado. Saldo atualizado no painel: ${brl}.`
        : "Este pagamento já foi registrado (mesmo identificador no extrato ou em outro comprovante).",
    };
  }

  const tx = syntheticTxFromReceipt(parsed);
  const amountCents = parsed.amountCents;
  const payerHint =
    parsed.payerName ??
    parseReceiptPayerName(parsed.rawText) ??
    extractPayerNameFromPluggyTransaction(tx);
  const memoBlob = buildReceiptPayerMemoBlob(parsed.rawText, payerHint);

  const user = await storage.getUser(userId);
  const accountOwnerNameKeys = [user?.name, user?.username]
    .map((n) => (typeof n === "string" ? normalizeAliasKey(n.trim()) : ""))
    .filter((k) => k.length >= 3);

  const resolved = await resolvePluggyCreditContact(
    userId,
    tx,
    amountCents,
    settings,
    memoBlob,
    payerHint,
    null,
    { accountOwnerNameKeys },
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

  const studentName = displayNameFromGuestContact(resolved.contact);

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
    const synced = await syncExistingLedgerCreditToBalance(userId, dedupeKey, resolved.contact.id);
    await storage.insertPaymentReceiptUpload({
      userId,
      dedupeKey,
      contactId: resolved.contact.id,
      amountCents,
      originalFilename: originalName.slice(0, 255),
      status: "duplicate",
      detail: apply.reason ?? "duplicate",
    });
    const brl =
      synced.balanceCents > 0 ?
        (synced.balanceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : null;
    return {
      ok: true,
      status: "duplicate",
      dedupeKey,
      contactId: resolved.contact.id,
      amountCents,
      payerName: parsed.payerName,
      balanceSyncedCents: synced.balanceCents > 0 ? synced.balanceCents : undefined,
      message:
        brl ?
          `Pagamento já estava registrado. Saldo atualizado no painel: ${brl}.`
        : "Pagamento já estava registrado.",
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
      `Comprovante aceito: ${apply.markedLessons} aula(s) marcada(s) como paga(s) para ${studentName}.`
    : `Comprovante aceito: crédito registrado para ${studentName} (saldo retido / aguardando aulas pendentes).`;

  return {
    ok: true,
    status: "matched",
    dedupeKey,
    contactId: resolved.contact.id,
    markedLessons: apply.markedLessons,
    amountCents,
    payerName: parsed.payerName,
    contactStudentName: studentName,
    message: msg,
  };
}

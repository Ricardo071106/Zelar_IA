export type LessonPaymentTag = "pendente" | "pago";

export function buildLessonCalendarTitle(opts: {
  baseTitle: string;
  studentLabel: string;
  lessonIndex: number | null;
  lessonTotal: number | null;
  paymentStatus: LessonPaymentTag;
}): string {
  const pay = opts.paymentStatus === "pago" ? "(pago)" : "(pendente)";
  const hasPack =
    opts.lessonTotal != null && opts.lessonTotal > 1 && opts.lessonIndex != null && opts.lessonIndex > 0;
  const mid = hasPack
    ? opts.lessonIndex === opts.lessonTotal
      ? `(última) ${pay}`
      : `(${opts.lessonIndex}/${opts.lessonTotal}) ${pay}`
    : pay;
  const student = (opts.studentLabel || "Aluno").trim();
  return `${opts.baseTitle.trim()} · ${student} ${mid}`;
}

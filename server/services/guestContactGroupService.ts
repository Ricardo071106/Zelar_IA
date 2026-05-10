/**
 * MVP B2B: convites vêm só do cadastro individual no painel (alunos/clientes).
 * A expansão por menção a grupos de contatos no texto do WhatsApp fica desativada.
 */
export async function resolveGuestEmailsAndPhonesFromGroups(
  _ownerUserId: number,
  _text: string,
): Promise<{ emails: string[]; phones: string[] }> {
  return { emails: [], phones: [] };
}

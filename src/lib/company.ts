import "server-only";

// Dados cadastrais lidos exclusivamente no servidor. Não exportar para rotas públicas.
export function getSharpixelConfig() {
  return {
    cpf: process.env.SHARPIXEL_CPF || "",
    nome: process.env.SHARPIXEL_NOME || "",
    nomeComercial: process.env.SHARPIXEL_NOME_COMERCIAL || "Sharpixel",
    cnpj: process.env.SHARPIXEL_CNPJ || "",
    email: process.env.SHARPIXEL_EMAIL || "",
    telefone: process.env.SHARPIXEL_TELEFONE || "",
    endereco: process.env.SHARPIXEL_ENDERECO || ""
  };
}

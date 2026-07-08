import { Link } from "react-router-dom";
import LegalLayout, { LegalSection, LegalList } from "./LegalLayout";

function DataTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03]">
            <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Categoria</th>
            <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Dados</th>
            <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Finalidade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/[0.05] last:border-0">
              <td className="px-4 py-3 align-top font-medium text-zinc-200">{r[0]}</td>
              <td className="px-4 py-3 align-top text-zinc-400">{r[1]}</td>
              <td className="px-4 py-3 align-top text-zinc-400">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="RGPD · Documento legal"
      title="Política de Privacidade"
      subtitle="Explicamos aqui, de forma transparente, que dados recolhemos, porquê, durante quanto tempo e quais os teus direitos ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD)."
      updated="08/07/2026"
    >
      <LegalSection number="1" title="Responsável pelo tratamento">
        <p>
          O responsável pelo tratamento dos dados pessoais recolhidos através do Lusorae é a equipa Lusorae,
          contactável através do email <span className="font-mono text-zinc-200">geral@lusorae.pt</span>.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Dados que recolhemos">
        <p>Aplicamos o princípio da minimização: recolhemos apenas o estritamente necessário.</p>
        <DataTable
          rows={[
            ["Conta", "Email, nome da organização, palavra-passe (armazenada apenas como hash bcrypt — nunca em texto simples)", "Criação e autenticação da conta"],
            ["Consentimento", "Data/hora e versão dos Termos aceites no registo", "Prova de aceitação contratual"],
            ["Jogo", "Estado da organização: recursos, equipas, operacionais, veículos, propriedades, eventos e progressão", "Funcionamento e persistência do jogo"],
            ["Segurança", "Endereço IP e contagem de tentativas de login falhadas (registo temporário)", "Prevenção de acessos abusivos (bloqueio temporário)"],
            ["Técnicos", "Cookies de sessão (tokens JWT httpOnly) e tokens no armazenamento local do browser", "Manter a sessão iniciada de forma segura"],
          ]}
        />
        <p>
          <strong className="text-zinc-200">Não recolhemos</strong>: dados de pagamento, localização real, contactos,
          dados biométricos ou quaisquer categorias especiais de dados. Não utilizamos cookies de publicidade nem de
          rastreamento de terceiros.
        </p>
      </LegalSection>

      <LegalSection number="3" title="Fundamentos e finalidades">
        <LegalList
          items={[
            "Execução do contrato (art. 6.º/1-b RGPD): criação de conta, autenticação e persistência do progresso de jogo.",
            "Interesse legítimo (art. 6.º/1-f RGPD): segurança do serviço, prevenção de fraude e de acessos não autorizados.",
            "Consentimento (art. 6.º/1-a RGPD): aceitação dos Termos e desta Política no momento do registo.",
          ]}
        />
      </LegalSection>

      <LegalSection number="4" title="Cookies e tokens de sessão">
        <p>Utilizamos exclusivamente cookies técnicos essenciais, sem finalidade publicitária:</p>
        <DataTable
          rows={[
            ["access_token", "Cookie httpOnly, seguro, validade 1 hora", "Autenticação da sessão ativa"],
            ["refresh_token", "Cookie httpOnly, seguro, validade 7 dias", "Renovação automática da sessão"],
            ["Armazenamento local", "Cópia dos tokens e preferências de interface", "Continuidade da sessão e definições do jogador"],
          ]}
        />
        <p>
          Por serem estritamente necessários ao funcionamento do serviço, estes cookies não requerem consentimento
          adicional. Podes eliminá-los a qualquer momento nas definições do teu browser (terminando a sessão).
        </p>
      </LegalSection>

      <LegalSection number="5" title="Partilha de dados">
        <p>
          <strong className="text-zinc-200">Não vendemos nem cedemos os teus dados a terceiros.</strong> Os dados são
          alojados em infraestrutura de alojamento cloud contratada para o efeito, atuando o fornecedor como
          subcontratante nos termos do art. 28.º do RGPD. Os mosaicos do mapa são servidos por terceiros
          (CARTO/OpenStreetMap), que podem registar o teu IP ao servir as imagens do mapa, nos termos das respetivas políticas.
        </p>
      </LegalSection>

      <LegalSection number="6" title="Prazos de conservação">
        <LegalList
          items={[
            "Dados de conta e de jogo: conservados enquanto a conta existir.",
            "Registos de tentativas de login: eliminados automaticamente após o desbloqueio ou login bem-sucedido.",
            "Conta eliminada: os dados de conta e de jogo são removidos de forma definitiva.",
            "Reinícios de temporada podem eliminar dados de progressão, sendo comunicados com antecedência.",
          ]}
        />
      </LegalSection>

      <LegalSection number="7" title="Segurança">
        <LegalList
          items={[
            "Palavras-passe protegidas com bcrypt (hash com salt) — nunca armazenadas em texto simples.",
            "Comunicações cifradas com HTTPS/TLS em todo o serviço.",
            "Cookies de sessão httpOnly e secure, inacessíveis a scripts de terceiros.",
            "Bloqueio temporário automático após tentativas de login falhadas consecutivas.",
            "Requisitos mínimos de força da palavra-passe no registo e na alteração.",
          ]}
        />
      </LegalSection>

      <LegalSection number="8" title="Os teus direitos (RGPD)">
        <p>Enquanto titular dos dados, tens direito a:</p>
        <LegalList
          items={[
            "Acesso — obter confirmação e cópia dos dados que tratamos sobre ti;",
            "Retificação — corrigir dados inexatos (o email e o nome da organização podem ser geridos nas Definições);",
            "Apagamento — eliminar a conta e todos os dados associados, diretamente nas Definições do jogo;",
            "Portabilidade — receber os teus dados num formato estruturado e de leitura automática;",
            "Oposição e limitação — opor-te ou limitar tratamentos baseados em interesse legítimo;",
            "Reclamação — apresentar queixa à CNPD (Comissão Nacional de Proteção de Dados) em www.cnpd.pt.",
          ]}
        />
        <p>
          Para exercer qualquer direito, contacta-nos em <span className="font-mono text-zinc-200">geral@lusorae.pt</span>.
          Respondemos no prazo máximo de 30 dias.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Menores">
        <p>
          O serviço destina-se a maiores de 16 anos. Não recolhemos conscientemente dados de menores dessa idade;
          se tomarmos conhecimento de um registo nessas condições, a conta será eliminada.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Alterações a esta política">
        <p>
          Poderemos atualizar esta Política para refletir alterações do serviço ou obrigações legais. A data da última
          atualização consta no topo. Alterações materiais serão comunicadas na aplicação antes de produzirem efeitos.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Contacto">
        <p>
          Questões sobre privacidade e proteção de dados: <span className="font-mono text-zinc-200">geral@lusorae.pt</span>.
          Consulta também os <Link to="/termos" className="text-primary underline-offset-2 hover:underline">Termos e Condições</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

import { Link } from "react-router-dom";
import LegalLayout, { LegalSection, LegalList } from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Documento legal"
      title="Termos e Condições"
      subtitle="Estes termos regulam o acesso e a utilização do Lusorae. Ao criares conta ou utilizares o serviço, declaras que os leste, compreendeste e aceitaste."
      updated="08/07/2026"
    >
      <LegalSection number="1" title="Objeto e aceitação">
        <p>
          Os presentes Termos e Condições («Termos») estabelecem as regras de utilização do <strong className="text-zinc-200">Lusorae</strong>,
          um jogo de estratégia e simulação de gestão em browser («Serviço»). A criação de conta exige a aceitação
          expressa destes Termos e da <Link to="/privacidade" className="text-primary underline-offset-2 hover:underline">Política de Privacidade</Link>.
          Se não concordares com qualquer disposição, não deves utilizar o Serviço.
        </p>
        <p>
          A data, hora e versão dos Termos aceites são registadas na tua conta no momento do registo, para efeitos de prova.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Descrição do serviço">
        <p>
          O Lusorae é um simulador de estratégia em que o jogador gere uma organização fictícia num mapa virtual de Lisboa:
          equipas, operacionais, veículos, propriedades e uma economia interna de jogo. O Serviço encontra-se em
          desenvolvimento ativo (Temporada 0) e evolui por temporadas, com novas funcionalidades documentadas no{" "}
          <Link to="/changelog" className="text-primary underline-offset-2 hover:underline">Changelog</Link>.
        </p>
      </LegalSection>

      <LegalSection number="3" title="Natureza ficcional do conteúdo">
        <p>
          Todo o conteúdo do jogo — narrativa, missões, personagens, organizações e mecânicas — é{" "}
          <strong className="text-zinc-200">totalmente ficcional</strong> e destinado exclusivamente a entretenimento.
          O Lusorae não promove, glorifica nem incentiva qualquer atividade ilegal no mundo real. Qualquer semelhança
          com pessoas, organizações ou eventos reais é mera coincidência.
        </p>
      </LegalSection>

      <LegalSection number="4" title="Elegibilidade">
        <p>
          O Serviço destina-se a utilizadores com <strong className="text-zinc-200">idade igual ou superior a 16 anos</strong>,
          dada a temática de simulação criminal ficcional. Ao registares-te, declaras cumprir este requisito.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Conta, credenciais e segurança">
        <LegalList
          items={[
            "Cada utilizador pode manter uma conta pessoal e intransmissível, associada a um email válido.",
            "És responsável pela confidencialidade das tuas credenciais e por toda a atividade realizada na tua conta.",
            "A palavra-passe deve cumprir os requisitos mínimos de segurança apresentados no registo (8+ caracteres, letras e números).",
            "Por motivos de segurança, tentativas de login falhadas consecutivas resultam num bloqueio temporário.",
            "Deves notificar-nos de imediato se suspeitares de acesso não autorizado à tua conta.",
          ]}
        />
      </LegalSection>

      <LegalSection number="6" title="Conduta do utilizador">
        <p>Ao utilizares o Serviço, comprometes-te a não:</p>
        <LegalList
          items={[
            "Explorar bugs, automatizar ações (bots, scripts) ou manipular a economia do jogo de forma fraudulenta;",
            "Aceder ou tentar aceder a contas de terceiros, ou interferir com a infraestrutura do Serviço;",
            "Utilizar nomes de organização ofensivos, difamatórios, discriminatórios ou que violem direitos de terceiros;",
            "Fazer engenharia reversa, copiar ou redistribuir o Serviço ou partes dele sem autorização escrita;",
            "Utilizar o Serviço para qualquer finalidade ilegal ou não autorizada.",
          ]}
        />
        <p>
          A violação destas regras pode resultar em aviso, suspensão temporária ou banimento definitivo da conta,
          consoante a gravidade, sem direito a qualquer compensação.
        </p>
      </LegalSection>

      <LegalSection number="7" title="Conteúdo virtual e moeda de jogo">
        <p>
          Todos os bens virtuais do jogo — dinheiro limpo/sujo, respeito, veículos, propriedades, operacionais e restantes
          recursos — <strong className="text-zinc-200">não têm qualquer valor monetário real</strong>, não são resgatáveis,
          transmissíveis nem convertíveis em dinheiro ou bens fora do jogo. Constituem uma licença limitada, revogável e
          não exclusiva de utilização dentro do Serviço.
        </p>
      </LegalSection>

      <LegalSection number="8" title="Disponibilidade, temporadas e alterações">
        <LegalList
          items={[
            "O Serviço é disponibilizado 'tal como está' ('as is'), em fase de desenvolvimento ativo, podendo conter erros.",
            "Podemos alterar, suspender ou descontinuar funcionalidades a qualquer momento, incluindo ajustes de equilíbrio da economia.",
            "O jogo evolui por temporadas: no arranque de uma nova temporada pode ocorrer reinício parcial ou total do progresso, sendo tal comunicado com antecedência razoável.",
            "Não garantimos disponibilidade contínua nem ausência de perda de dados, embora sejam aplicadas salvaguardas técnicas.",
          ]}
        />
      </LegalSection>

      <LegalSection number="9" title="Propriedade intelectual">
        <p>
          O Lusorae, incluindo o nome, logótipo, design, código, textos, mecânicas e todos os elementos do jogo, é protegido
          por direitos de propriedade intelectual. É concedida apenas uma licença pessoal, limitada e não exclusiva de
          utilização do Serviço para fins de entretenimento. O mapa é renderizado com dados de terceiros (OpenStreetMap/CARTO),
          sujeitos às respetivas licenças.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Proteção de dados pessoais">
        <p>
          O tratamento de dados pessoais é regido pela nossa{" "}
          <Link to="/privacidade" className="text-primary underline-offset-2 hover:underline">Política de Privacidade</Link>,
          elaborada em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD). Recolhemos apenas os dados
          estritamente necessários ao funcionamento do Serviço.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Limitação de responsabilidade">
        <p>
          Na máxima medida permitida por lei, não somos responsáveis por danos indiretos, perda de progresso de jogo,
          indisponibilidade temporária do Serviço ou prejuízos resultantes de utilização indevida da conta. Nada nestes
          Termos exclui responsabilidades que não possam ser excluídas ao abrigo da lei portuguesa.
        </p>
      </LegalSection>

      <LegalSection number="12" title="Suspensão e cessação">
        <LegalList
          items={[
            "Podes eliminar a tua conta a qualquer momento nas Definições do jogo — a eliminação é definitiva e remove os teus dados de jogo.",
            "Podemos suspender ou encerrar contas que violem estes Termos, com efeito imediato em casos graves.",
            "Contas banidas mantêm o registo do motivo do banimento para efeitos de auditoria.",
          ]}
        />
      </LegalSection>

      <LegalSection number="13" title="Alterações aos termos">
        <p>
          Podemos atualizar estes Termos para refletir alterações legais ou funcionais do Serviço. A versão em vigor e a
          data de atualização constam sempre no topo desta página. Alterações materiais serão comunicadas na aplicação.
          A utilização continuada do Serviço após a entrada em vigor das alterações constitui aceitação das mesmas.
        </p>
      </LegalSection>

      <LegalSection number="14" title="Lei aplicável e foro">
        <p>
          Estes Termos regem-se pela lei portuguesa. Para a resolução de qualquer litígio emergente destes Termos é
          competente o foro da comarca de Lisboa, sem prejuízo das normas imperativas de proteção do consumidor aplicáveis.
        </p>
      </LegalSection>

      <LegalSection number="15" title="Contacto">
        <p>
          Para questões sobre estes Termos, contacta a equipa através do email{" "}
          <span className="font-mono text-zinc-200">geral@lusorae.pt</span>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

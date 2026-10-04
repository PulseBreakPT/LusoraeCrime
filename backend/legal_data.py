"""Documentos legais versionados do SUBMUNDO (data-driven).

Arquitetura preparada para futuras versões: cada documento tem uma lista de
versões ordenada da mais antiga para a mais recente. A versão atual é sempre
a última da lista. Ao publicar uma nova versão basta acrescentá-la à lista —
as aceitações antigas continuam associadas à versão que o utilizador aceitou.
"""

CONTACT_EMAIL = "geral@lusorae.pt"

# ---------------------------------------------------------------------------
# Documentos legais
# ---------------------------------------------------------------------------

LEGAL_DOCUMENTS = {
    "terms": {
        "id": "terms",
        "title": "Termos de Serviço",
        "versions": [
            {
                "version": "1.0",
                "effective_date": "2026-07-08",
                "summary": "Regras de utilização da plataforma SUBMUNDO, contas, conduta, propriedade intelectual e responsabilidade.",
                "sections": [
                    {
                        "heading": "1. Sobre o SUBMUNDO",
                        "paragraphs": [
                            "O SUBMUNDO é um jogo de estratégia e gestão totalmente ficcional, ambientado numa versão imaginária de Lisboa. Todos os eventos, organizações, atividades e mecânicas do jogo são obra de ficção e destinam-se exclusivamente a entretenimento.",
                            "O SUBMUNDO não promove, incentiva ou glorifica qualquer atividade ilegal no mundo real. Qualquer semelhança com pessoas, organizações ou eventos reais é pura coincidência.",
                            "Ao criar uma conta ou utilizar a plataforma, aceitas estes Termos de Serviço na íntegra. Se não concordares com alguma parte, não deves utilizar o SUBMUNDO.",
                        ],
                    },
                    {
                        "heading": "2. Utilização da plataforma",
                        "paragraphs": [
                            "O SUBMUNDO é disponibilizado através do navegador web e, futuramente, de aplicações móveis. A utilização é pessoal e intransmissível.",
                        ],
                        "bullets": [
                            "Deves ter pelo menos 16 anos para criar uma conta.",
                            "É proibido utilizar bots, scripts, automatismos ou qualquer forma de acesso não autorizado.",
                            "É proibido explorar bugs ou falhas para obter vantagens — encontraste um bug? Reporta-o através do contacto oficial.",
                            "É proibido tentar aceder a contas de outros utilizadores ou a áreas restritas da plataforma.",
                            "A venda, troca ou partilha de contas não é permitida.",
                        ],
                    },
                    {
                        "heading": "3. Contas",
                        "paragraphs": [
                            "Para jogar precisas de criar uma conta com um endereço de email válido, um nome de organização e uma palavra-passe segura.",
                            "És responsável por manter a confidencialidade das tuas credenciais e por toda a atividade que ocorra na tua conta. Se suspeitares de acesso não autorizado, altera a palavra-passe imediatamente e contacta-nos.",
                            "Cada pessoa deve ter apenas uma conta. Contas duplicadas podem ser suspensas.",
                        ],
                    },
                    {
                        "heading": "4. Comportamento esperado",
                        "paragraphs": [
                            "Queremos que o SUBMUNDO seja um espaço de jogo justo e respeitador. Ao utilizar a plataforma comprometes-te a:",
                        ],
                        "bullets": [
                            "Escolher nomes de organização que não sejam ofensivos, discriminatórios ou que se façam passar por terceiros.",
                            "Não assediar, ameaçar ou difamar outros utilizadores ou a equipa do SUBMUNDO.",
                            "Não publicar ou transmitir conteúdo ilegal, obsceno ou que viole direitos de terceiros.",
                            "Jogar de forma justa, sem recorrer a exploits, automatismos ou manipulação do cliente.",
                        ],
                    },
                    {
                        "heading": "5. Propriedade intelectual",
                        "paragraphs": [
                            "Todo o conteúdo do SUBMUNDO — incluindo o nome, logótipo, design, interface, textos, mecânicas de jogo, dados de jogo e código — é propriedade do SUBMUNDO ou dos seus licenciadores e está protegido pela legislação de direitos de autor e propriedade industrial.",
                            "É-te concedida uma licença limitada, não exclusiva e revogável para utilizar a plataforma para fins pessoais e não comerciais. Esta licença não te transfere qualquer direito de propriedade.",
                            "O progresso de jogo, moedas virtuais, funcionários, veículos e propriedades dentro do jogo não têm valor monetário real e não constituem propriedade do utilizador.",
                        ],
                    },
                    {
                        "heading": "6. Disponibilidade e limitações",
                        "paragraphs": [
                            "O SUBMUNDO encontra-se em desenvolvimento ativo. A plataforma é fornecida \"tal como está\" e \"conforme disponível\".",
                        ],
                        "bullets": [
                            "Podem ocorrer interrupções de serviço para manutenção, atualizações ou por causas técnicas imprevistas.",
                            "Mecânicas de jogo, economia e conteúdos podem ser alterados, reequilibrados ou removidos a qualquer momento — consulta o Changelog para acompanhar as alterações.",
                            "Não garantimos que o progresso de jogo seja preservado em situações excecionais (falhas técnicas graves, reinícios de temporada anunciados).",
                        ],
                    },
                    {
                        "heading": "7. Suspensão e encerramento de contas",
                        "paragraphs": [
                            "Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos, nomeadamente em casos de:",
                        ],
                        "bullets": [
                            "Utilização de bots, exploits ou manipulação do jogo.",
                            "Comportamento abusivo para com outros utilizadores ou para com a equipa.",
                            "Tentativas de acesso não autorizado ou ataques à infraestrutura.",
                            "Nomes de organização ofensivos ou fraudulentos.",
                        ],
                        "paragraphs_after": [
                            "Sempre que possível, a suspensão será comunicada com indicação do motivo. Podes contestar uma suspensão através do contacto oficial.",
                            "Podes eliminar a tua conta a qualquer momento nas Definições do jogo — a eliminação é imediata e irreversível.",
                        ],
                    },
                    {
                        "heading": "8. Responsabilidade",
                        "paragraphs": [
                            "Na máxima medida permitida pela lei portuguesa, o SUBMUNDO não se responsabiliza por danos indiretos, perda de dados de jogo, lucros cessantes ou quaisquer prejuízos decorrentes da utilização ou impossibilidade de utilização da plataforma.",
                            "Nada nestes Termos exclui ou limita a responsabilidade que não possa ser excluída ou limitada por lei, incluindo os direitos que te assistem enquanto consumidor.",
                        ],
                    },
                    {
                        "heading": "9. Alterações a estes Termos",
                        "paragraphs": [
                            "Podemos atualizar estes Termos para refletir alterações na plataforma, na lei ou nas nossas práticas. Cada versão tem um número e uma data de entrada em vigor.",
                            "Alterações relevantes serão comunicadas na plataforma. A utilização continuada do SUBMUNDO após a entrada em vigor de uma nova versão constitui aceitação da mesma.",
                            "O histórico de versões destes documentos é preservado — a tua conta guarda sempre a versão que aceitaste e a data em que o fizeste.",
                        ],
                    },
                    {
                        "heading": "10. Lei aplicável e contacto",
                        "paragraphs": [
                            "Estes Termos regem-se pela lei portuguesa. Qualquer litígio será submetido aos tribunais portugueses competentes, sem prejuízo das normas imperativas de proteção do consumidor.",
                            f"Para qualquer questão sobre estes Termos, contacta-nos através de {CONTACT_EMAIL}.",
                        ],
                    },
                ],
            },
        ],
    },
    "privacy": {
        "id": "privacy",
        "title": "Política de Privacidade",
        "versions": [
            {
                "version": "1.0",
                "effective_date": "2026-07-08",
                "summary": "Que informação recolhemos, como a utilizamos, onde a guardamos e com quem a partilhamos.",
                "sections": [
                    {
                        "heading": "1. Introdução",
                        "paragraphs": [
                            "Esta Política de Privacidade explica que informação o SUBMUNDO recolhe, como a utiliza e que escolhas tens sobre os teus dados.",
                            "Levamos a privacidade a sério: recolhemos apenas o mínimo necessário para a plataforma funcionar. Para informação detalhada sobre os teus direitos ao abrigo do RGPD, consulta a nossa página dedicada ao RGPD.",
                        ],
                    },
                    {
                        "heading": "2. Informação que recolhemos",
                        "paragraphs": [
                            "Recolhemos apenas os dados estritamente necessários:",
                        ],
                        "bullets": [
                            "Dados de conta: endereço de email, nome da organização (escolhido por ti) e palavra-passe (guardada de forma cifrada e irreversível — nunca em texto simples).",
                            "Dados de jogo: progresso, recursos, equipas, funcionários fictícios, veículos, propriedades e histórico de eventos do teu império virtual.",
                            "Dados de aceitação legal: data, hora e versão dos Termos de Serviço e Política de Privacidade que aceitaste.",
                            "Dados técnicos de segurança: endereço IP associado a tentativas de início de sessão (para proteção contra ataques de força bruta) e ao momento do registo.",
                        ],
                    },
                    {
                        "heading": "3. Como utilizamos a informação",
                        "bullets": [
                            "Autenticar a tua conta e manter a tua sessão iniciada.",
                            "Guardar e sincronizar o teu progresso de jogo.",
                            "Proteger a plataforma contra abusos, fraude e acessos não autorizados.",
                            "Cumprir obrigações legais, incluindo o registo da aceitação dos documentos legais.",
                            "Comunicar contigo sobre a tua conta quando estritamente necessário.",
                        ],
                        "paragraphs": [
                            "Não utilizamos os teus dados para publicidade. Não vendemos, alugamos ou cedemos os teus dados a terceiros para fins comerciais.",
                        ],
                    },
                    {
                        "heading": "4. Armazenamento e segurança",
                        "paragraphs": [
                            "Os teus dados são guardados em servidores seguros, com acesso restrito. Aplicamos medidas técnicas e organizativas adequadas:",
                        ],
                        "bullets": [
                            "Palavras-passe cifradas com bcrypt (hash com salt, irreversível).",
                            "Comunicações protegidas por HTTPS/TLS.",
                            "Sessões geridas com tokens de curta duração e cookies httpOnly.",
                            "Bloqueio automático de tentativas de acesso repetidas (proteção contra força bruta).",
                            "Acesso administrativo restrito e registado.",
                        ],
                    },
                    {
                        "heading": "5. Partilha com terceiros",
                        "paragraphs": [
                            "Não partilhamos os teus dados pessoais com terceiros, exceto:",
                        ],
                        "bullets": [
                            "Fornecedores de infraestrutura técnica (alojamento e base de dados), estritamente para operar a plataforma e vinculados por obrigações de confidencialidade.",
                            "Autoridades competentes, quando exigido por lei.",
                        ],
                    },
                    {
                        "heading": "6. Cookies",
                        "paragraphs": [
                            "O SUBMUNDO utiliza apenas cookies estritamente necessários ao funcionamento:",
                        ],
                        "bullets": [
                            "access_token — cookie de sessão (httpOnly) que te mantém autenticado. Expira em 1 hora.",
                            "refresh_token — cookie (httpOnly) que permite renovar a sessão sem novo login. Expira em 7 dias.",
                        ],
                        "paragraphs_after": [
                            "Não utilizamos cookies de publicidade, de rastreio entre sites ou de terceiros. Também é utilizado o armazenamento local do navegador (localStorage) para guardar preferências de interface e o estado da sessão.",
                        ],
                    },
                    {
                        "heading": "7. Analytics",
                        "paragraphs": [
                            "Atualmente o SUBMUNDO não utiliza qualquer serviço de analytics de terceiros (como Google Analytics).",
                            "Se no futuro adotarmos ferramentas de medição de utilização, esta política será atualizada antes da sua ativação e serás informado na plataforma.",
                        ],
                    },
                    {
                        "heading": "8. Conservação dos dados",
                        "paragraphs": [
                            "Os teus dados são conservados enquanto a tua conta existir. Ao eliminares a conta, todos os dados pessoais e de jogo são apagados de forma permanente e imediata.",
                            "Registos técnicos de segurança (tentativas de login) são conservados apenas pelo tempo necessário à proteção da plataforma.",
                        ],
                    },
                    {
                        "heading": "9. Alterações a esta política",
                        "paragraphs": [
                            "Esta política pode ser atualizada. Cada versão tem número e data de entrada em vigor, e o histórico é preservado. Alterações relevantes serão comunicadas na plataforma.",
                        ],
                    },
                    {
                        "heading": "10. Contacto",
                        "paragraphs": [
                            f"Para qualquer questão sobre privacidade ou sobre os teus dados, contacta-nos através de {CONTACT_EMAIL}. Respondemos no prazo máximo de 30 dias.",
                        ],
                    },
                ],
            },
        ,
            {
                            "version": "1.1",
                            "effective_date": "2026-10-03",
                            "summary": "Atualização Google Play: Google Sign-In, minimização de dados e eliminação de conta dentro e fora da aplicação.",
                            "sections": [
                                {
                                    "heading": "1. Introdução",
                                    "paragraphs": [
                                        "Esta Política de Privacidade explica que informação o SUBMUNDO recolhe, como a utiliza e que escolhas tens sobre os teus dados.",
                                        "Levamos a privacidade a sério: recolhemos apenas o mínimo necessário para a plataforma funcionar. Para informação detalhada sobre os teus direitos ao abrigo do RGPD, consulta a nossa página dedicada ao RGPD.",
                                    ],
                                },
                                {
                                    "heading": "2. Informação que recolhemos",
                                    "paragraphs": [
                                        "Recolhemos apenas os dados estritamente necessários:",
                                    ],
                                    "bullets": [
                                        "Dados de conta: endereço de email, nome da organização (escolhido por ti) e palavra-passe (guardada de forma cifrada e irreversível — nunca em texto simples).",
                                        "Dados de jogo: progresso, recursos, equipas, funcionários fictícios, veículos, propriedades e histórico de eventos do teu império virtual.",
                                        "Dados de aceitação legal: data, hora e versão dos Termos de Serviço e Política de Privacidade que aceitaste.",
                                        "Dados técnicos de segurança: endereço IP associado a tentativas de início de sessão (para proteção contra ataques de força bruta) e ao momento do registo.",
                                    ],
                                },
                                {
                                    "heading": "3. Como utilizamos a informação",
                                    "bullets": [
                                        "Autenticar a tua conta e manter a tua sessão iniciada.",
                                        "Guardar e sincronizar o teu progresso de jogo.",
                                        "Proteger a plataforma contra abusos, fraude e acessos não autorizados.",
                                        "Cumprir obrigações legais, incluindo o registo da aceitação dos documentos legais.",
                                        "Comunicar contigo sobre a tua conta quando estritamente necessário.",
                                    ],
                                    "paragraphs": [
                                        "Não utilizamos os teus dados para publicidade. Não vendemos, alugamos ou cedemos os teus dados a terceiros para fins comerciais.",
                                    ],
                                },
                                {
                                    "heading": "4. Armazenamento e segurança",
                                    "paragraphs": [
                                        "Os teus dados são guardados em servidores seguros, com acesso restrito. Aplicamos medidas técnicas e organizativas adequadas:",
                                    ],
                                    "bullets": [
                                        "Palavras-passe cifradas com bcrypt (hash com salt, irreversível).",
                                        "Comunicações protegidas por HTTPS/TLS.",
                                        "Sessões geridas com tokens de curta duração e cookies httpOnly.",
                                        "Bloqueio automático de tentativas de acesso repetidas (proteção contra força bruta).",
                                        "Acesso administrativo restrito e registado.",
                                    ],
                                },
                                {
                                    "heading": "5. Partilha com terceiros",
                                    "paragraphs": [
                                        "Não partilhamos os teus dados pessoais com terceiros, exceto:",
                                    ],
                                    "bullets": [
                                        "Fornecedores de infraestrutura técnica (alojamento e base de dados), estritamente para operar a plataforma.",\n                            "Google, apenas quando escolhes Google Sign-In, para autenticar a identidade da conta.",
                                        "Autoridades competentes, quando exigido por lei.",
                                    ],
                                },
                                {
                                    "heading": "6. Cookies",
                                    "paragraphs": [
                                        "Na versão web, o SUBMUNDO utiliza apenas cookies/armazenamento estritamente necessários ao funcionamento. Na aplicação Android, os tokens de sessão são geridos pelo cliente e enviados por HTTPS:",
                                    ],
                                    "bullets": [
                                        "access_token — cookie de sessão (httpOnly) que te mantém autenticado. Expira em 1 hora.",
                                        "refresh_token — cookie (httpOnly) que permite renovar a sessão sem novo login. Expira em 7 dias.",
                                    ],
                                    "paragraphs_after": [
                                        "Não utilizamos cookies de publicidade, de rastreio entre sites ou de terceiros. Também é utilizado o armazenamento local do navegador (localStorage) para guardar preferências de interface e o estado da sessão.",
                                    ],
                                },
                                {
                                    "heading": "7. Analytics",
                                    "paragraphs": [
                                        "Atualmente o SUBMUNDO não utiliza qualquer serviço de analytics de terceiros (como Google Analytics).",
                                        "Se no futuro adotarmos ferramentas de medição de utilização, esta política será atualizada antes da sua ativação e serás informado na plataforma.",
                                    ],
                                },
                                {
                                    "heading": "8. Conservação dos dados",
                                    "paragraphs": [
                                        "Os teus dados são conservados enquanto a tua conta existir. Ao eliminares a conta, todos os dados pessoais e de jogo são apagados de forma permanente e imediata.",
                                        "Registos técnicos de segurança (tentativas de login) são conservados apenas pelo tempo necessário à proteção da plataforma.",
                                    ],
                                },
                                {
                                    "heading": "9. Alterações a esta política",
                                    "paragraphs": [
                                        "Esta política pode ser atualizada. Cada versão tem número e data de entrada em vigor, e o histórico é preservado. Alterações relevantes serão comunicadas na plataforma.",
                                    ],
                                },
                                {
                                    "heading": "10. Contacto",
                                    "paragraphs": [
                                        f"Para qualquer questão sobre privacidade ou sobre os teus dados, contacta-nos através de {CONTACT_EMAIL}. Respondemos no prazo máximo de 30 dias.",
                                    ],
                                },
                            ],
                        }],
    },
    "rgpd": {
        "id": "rgpd",
        "title": "RGPD — Proteção de Dados",
        "versions": [
            {
                "version": "1.0",
                "effective_date": "2026-07-08",
                "summary": "Os teus direitos ao abrigo do Regulamento Geral sobre a Proteção de Dados, explicados em linguagem simples.",
                "sections": [
                    {
                        "heading": "1. O que é isto?",
                        "paragraphs": [
                            "O RGPD (Regulamento Geral sobre a Proteção de Dados) é a lei europeia que protege os teus dados pessoais. Esta página explica, em linguagem simples, que dados o SUBMUNDO recolhe, porquê, durante quanto tempo, e que direitos tens sobre eles.",
                            "Responsável pelo tratamento: SUBMUNDO. O contacto de suporte oficial está disponível na aplicação.",
                        ],
                    },
                    {
                        "heading": "2. Que dados recolhemos",
                        "bullets": [
                            "Email — para criares conta, entrares e recuperares o acesso.",
                            "Nome da organização — o nome público do teu império no jogo (escolhido por ti; evita usar o teu nome real).",
                            "Palavra-passe — guardada cifrada (bcrypt); nem nós a conseguimos ler.",
                            "Endereço IP — apenas para segurança (bloqueio de tentativas de login abusivas e registo da aceitação dos termos).",
                            "Dados de jogo — o teu progresso: recursos, equipas, veículos, propriedades e eventos. São dados fictícios do jogo, mas estão associados à tua conta.",
                            "Aceitação legal — data, hora e versão dos documentos que aceitaste ao registar-te.",
                        ],
                        "paragraphs": [
                            "Não recolhemos: nome real, morada, telefone, dados de pagamento, localização real, contactos, nem qualquer dado sensível.",
                        ],
                    },
                    {
                        "heading": "3. Para que usamos os dados (finalidade)",
                        "bullets": [
                            "Criar e gerir a tua conta (execução do contrato — art. 6.º/1/b RGPD).",
                            "Guardar o teu progresso de jogo (execução do contrato).",
                            "Proteger a plataforma contra abusos e ataques (interesse legítimo — art. 6.º/1/f).",
                            "Registar a aceitação dos termos (obrigação legal e interesse legítimo).",
                        ],
                        "paragraphs": [
                            "Não fazemos definição de perfis, decisões automatizadas com efeitos legais, nem marketing com os teus dados.",
                        ],
                    },
                    {
                        "heading": "4. Durante quanto tempo guardamos (conservação)",
                        "bullets": [
                            "Dados de conta e de jogo — enquanto a conta existir. Apagados imediatamente quando eliminas a conta.",
                            "Registos de tentativas de login — no máximo 15 minutos após o bloqueio expirar; são limpos automaticamente.",
                            "Registo de aceitação dos termos — enquanto a conta existir (é apagado com ela).",
                        ],
                    },
                    {
                        "heading": "5. Como protegemos os dados (segurança)",
                        "bullets": [
                            "Palavras-passe cifradas com bcrypt — irreversível.",
                            "Ligações protegidas por HTTPS/TLS.",
                            "Sessões com tokens de curta duração e cookies httpOnly (inacessíveis a scripts).",
                            "Bloqueio automático após 5 tentativas de login falhadas (15 minutos).",
                            "Acesso à base de dados restrito à equipa técnica.",
                        ],
                    },
                    {
                        "heading": "6. Cookies",
                        "paragraphs": [
                            "Usamos apenas cookies estritamente necessários (sessão e renovação de sessão). Não há cookies de publicidade nem de rastreio. Por serem estritamente necessários, não exigem consentimento prévio ao abrigo da lei. Detalhes na Política de Privacidade.",
                        ],
                    },
                    {
                        "heading": "7. Os teus direitos",
                        "paragraphs": [
                            "O RGPD dá-te direitos concretos sobre os teus dados. Podes exercê-los diretamente na plataforma ou por email:",
                        ],
                        "bullets": [
                            "Direito de acesso — saber que dados temos sobre ti. Pede-nos uma cópia por email.",
                            "Direito de retificação — corrigir dados errados. Podes alterar a palavra-passe nas Definições; para corrigir o email, contacta-nos.",
                            "Direito ao apagamento (direito ao esquecimento) — eliminar a conta e todos os dados. Disponível diretamente nas Definições do jogo, com efeito imediato e irreversível.",
                            "Direito à portabilidade — receber os teus dados num formato estruturado e legível por máquina (JSON). Pede por email.",
                            "Direito de oposição e limitação — opores-te a determinados tratamentos ou pedir a sua limitação.",
                            "Direito de reclamação — apresentar queixa à CNPD (Comissão Nacional de Proteção de Dados) em www.cnpd.pt.",
                        ],
                    },
                    {
                        "heading": "8. Eliminação da conta",
                        "paragraphs": [
                            "Podes eliminar a tua conta a qualquer momento em Definições → Zona de Perigo → Eliminar Conta. É pedida a tua palavra-passe para confirmar.",
                            "A eliminação é imediata e permanente: conta, progresso de jogo, equipas, funcionários, veículos, propriedades, eventos e registo de aceitação legal — tudo é apagado. Não guardamos cópias.",
                        ],
                    },
                    {
                        "heading": "9. Transferências internacionais",
                        "paragraphs": [
                            "Os dados são tratados em servidores localizados na União Europeia ou em infraestruturas com garantias adequadas de proteção equivalente, conforme exigido pelo RGPD.",
                        ],
                    },
                    {
                        "heading": "10. Menores",
                        "paragraphs": [
                            "O SUBMUNDO destina-se a maiores de 16 anos. Não recolhemos conscientemente dados de menores de 16 anos. Se acreditas que um menor criou uma conta, contacta-nos para a sua remoção.",
                        ],
                    },
                    {
                        "heading": "11. Contacto",
                        "paragraphs": [
                            f"Para exercer qualquer direito ou esclarecer dúvidas: {CONTACT_EMAIL}. Respondemos no prazo máximo de 30 dias, conforme exigido pelo RGPD.",
                        ],
                    },
                ],
            },
        ,
            {
                            "version": "1.1",
                            "effective_date": "2026-10-03",
                            "summary": "Atualização para Google Sign-In, aplicação Android e eliminação de conta compatível com Google Play.",
                            "sections": [
                                {
                                    "heading": "1. O que é isto?",
                                    "paragraphs": [
                                        "O RGPD (Regulamento Geral sobre a Proteção de Dados) é a lei europeia que protege os teus dados pessoais. Esta página explica, em linguagem simples, que dados o SUBMUNDO recolhe, porquê, durante quanto tempo, e que direitos tens sobre eles.",
                                        "Responsável pelo tratamento: SUBMUNDO. O contacto de suporte oficial está disponível na aplicação.",
                                    ],
                                },
                                {
                                    "heading": "2. Que dados recolhemos",
                                    "bullets": [
                                        "Email — para criares conta, entrares e recuperares o acesso.",\n                            "Identificador Google — apenas quando escolhes Google Sign-In; usado para autenticação e associação segura da conta. Não guardamos a foto de perfil Google.",
                                        "Nome da organização — o nome público do teu império no jogo (escolhido por ti; evita usar o teu nome real).",
                                        "Palavra-passe — apenas para contas email/password; guardada como hash bcrypt irreversível.",
                                        "Endereço IP — apenas para segurança (bloqueio de tentativas de login abusivas e registo da aceitação dos termos).",
                                        "Dados de jogo — o teu progresso: recursos, equipas, veículos, propriedades e eventos. São dados fictícios do jogo, mas estão associados à tua conta.",
                                        "Aceitação legal — data, hora e versão dos documentos que aceitaste ao registar-te.",
                                    ],
                                    "paragraphs": [
                                        "Não recolhemos: nome real, morada, telefone, dados de pagamento, localização real, contactos, nem qualquer dado sensível.",
                                    ],
                                },
                                {
                                    "heading": "3. Para que usamos os dados (finalidade)",
                                    "bullets": [
                                        "Criar e gerir a tua conta (execução do contrato — art. 6.º/1/b RGPD).",
                                        "Guardar o teu progresso de jogo (execução do contrato).",
                                        "Proteger a plataforma contra abusos e ataques (interesse legítimo — art. 6.º/1/f).",
                                        "Registar a aceitação dos termos (obrigação legal e interesse legítimo).",
                                    ],
                                    "paragraphs": [
                                        "Não fazemos definição de perfis, decisões automatizadas com efeitos legais, nem marketing com os teus dados.",
                                    ],
                                },
                                {
                                    "heading": "4. Durante quanto tempo guardamos (conservação)",
                                    "bullets": [
                                        "Dados de conta e de jogo — enquanto a conta existir. Apagados imediatamente quando eliminas a conta.",
                                        "Registos de tentativas de login — no máximo 15 minutos após o bloqueio expirar; são limpos automaticamente.",
                                        "Registo de aceitação dos termos — enquanto a conta existir (é apagado com ela).",
                                    ],
                                },
                                {
                                    "heading": "5. Como protegemos os dados (segurança)",
                                    "bullets": [
                                        "Palavras-passe cifradas com bcrypt — irreversível.",
                                        "Ligações protegidas por HTTPS/TLS.",
                                        "Sessões com tokens de curta duração e cookies httpOnly (inacessíveis a scripts).",
                                        "Bloqueio automático após 5 tentativas de login falhadas (15 minutos).",
                                        "Acesso à base de dados restrito à equipa técnica.",
                                    ],
                                },
                                {
                                    "heading": "6. Cookies",
                                    "paragraphs": [
                                        "Usamos apenas cookies estritamente necessários (sessão e renovação de sessão). Não há cookies de publicidade nem de rastreio. Por serem estritamente necessários, não exigem consentimento prévio ao abrigo da lei. Detalhes na Política de Privacidade.",
                                    ],
                                },
                                {
                                    "heading": "7. Os teus direitos",
                                    "paragraphs": [
                                        "O RGPD dá-te direitos concretos sobre os teus dados. Podes exercê-los diretamente na plataforma ou por email:",
                                    ],
                                    "bullets": [
                                        "Direito de acesso — saber que dados temos sobre ti. Pede-nos uma cópia por email.",
                                        "Direito de retificação — corrigir dados errados. Podes alterar a palavra-passe nas Definições; para corrigir o email, contacta-nos.",
                                        "Direito ao apagamento (direito ao esquecimento) — eliminar a conta e todos os dados. Disponível diretamente nas Definições do jogo, com efeito imediato e irreversível.",
                                        "Direito à portabilidade — receber os teus dados num formato estruturado e legível por máquina (JSON). Pede por email.",
                                        "Direito de oposição e limitação — opores-te a determinados tratamentos ou pedir a sua limitação.",
                                        "Direito de reclamação — apresentar queixa à CNPD (Comissão Nacional de Proteção de Dados) em www.cnpd.pt.",
                                    ],
                                },
                                {
                                    "heading": "8. Eliminação da conta",
                                    "paragraphs": [
                                        "Podes eliminar a tua conta a qualquer momento em Definições → Conta → Eliminar conta. Contas com password confirmam com a password atual; contas Google-only confirmam através da sessão autenticada. Também existe um processo de pedido fora da aplicação na página pública de eliminação de conta.",
                                        "A eliminação é imediata e permanente: conta, progresso de jogo, equipas, funcionários, veículos, propriedades, eventos e registo de aceitação legal — tudo é apagado. Não guardamos cópias.",
                                    ],
                                },
                                {
                                    "heading": "9. Transferências internacionais",
                                    "paragraphs": [
                                        "Os dados são tratados em servidores localizados na União Europeia ou em infraestruturas com garantias adequadas de proteção equivalente, conforme exigido pelo RGPD.",
                                    ],
                                },
                                {
                                    "heading": "10. Menores",
                                    "paragraphs": [
                                        "O SUBMUNDO destina-se a maiores de 16 anos. Não recolhemos conscientemente dados de menores de 16 anos. Se acreditas que um menor criou uma conta, contacta-nos para a sua remoção.",
                                    ],
                                },
                                {
                                    "heading": "11. Contacto",
                                    "paragraphs": [
                                        f"Para exercer qualquer direito ou esclarecer dúvidas: {CONTACT_EMAIL}. Respondemos no prazo máximo de 30 dias, conforme exigido pelo RGPD.",
                                    ],
                                },
                            ],
                        }],
    },
}


def current_version(doc_id: str) -> dict | None:
    doc = LEGAL_DOCUMENTS.get(doc_id)
    if not doc or not doc["versions"]:
        return None
    return doc["versions"][-1]


def get_document(doc_id: str, version: str | None = None) -> dict | None:
    doc = LEGAL_DOCUMENTS.get(doc_id)
    if not doc:
        return None
    ver = None
    if version:
        ver = next((v for v in doc["versions"] if v["version"] == version), None)
    else:
        ver = doc["versions"][-1]
    if not ver:
        return None
    return {
        "id": doc["id"],
        "title": doc["title"],
        "available_versions": [
            {"version": v["version"], "effective_date": v["effective_date"]}
            for v in doc["versions"]
        ],
        **ver,
    }


def legal_meta() -> dict:
    return {
        "contact_email": CONTACT_EMAIL,
        "documents": {
            doc_id: {
                "id": doc_id,
                "title": doc["title"],
                "version": doc["versions"][-1]["version"],
                "effective_date": doc["versions"][-1]["effective_date"],
                "summary": doc["versions"][-1].get("summary", ""),
            }
            for doc_id, doc in LEGAL_DOCUMENTS.items()
        },
    }


# ---------------------------------------------------------------------------
# Changelog — organizado por versões, da mais recente para a mais antiga.
# Categorias: novidades, melhorias, correcoes, equilibrio, economia, interface
# ---------------------------------------------------------------------------

CHANGELOG = [
    {
        "version": "0.6.0",
        "date": "2026-07-08",
        "title": "Conta e documentos legais",
        "tag": "atual",
        "sections": {
            "novidades": [
                "Login e registo revistos, com validação imediata.",
                "Indicador de força da palavra-passe com requisitos visíveis antes de submeter.",
                "Verificação instantânea de disponibilidade do email e do nome da organização.",
                "Páginas dedicadas: Termos de Serviço, Política de Privacidade, RGPD e Changelog.",
                "Aceitação obrigatória dos Termos e Política de Privacidade no registo, com registo de data, hora e versão dos documentos.",
            ],
            "melhorias": [
                "Botão de mostrar/esconder palavra-passe e aviso de Caps Lock ativo.",
                "Mensagens de erro claras e específicas em todo o fluxo de autenticação.",
                "Recuperação automática de sessão expirada com renovação silenciosa do token.",
                "Contagem decrescente visível quando a conta fica temporariamente bloqueada.",
            ],
            "correcoes": [
                "Eliminada a possibilidade de submissões duplicadas no login e no registo.",
                "Eliminados estados de loading infinito em falhas de rede.",
            ],
            "interface": [
                "Novo ecrã de autenticação.",
                "Estados de foco, erro e loading consistentes e acessíveis em todos os campos.",
            ],
        },
    },
    {
        "version": "0.5.0",
        "date": "2026-07-07",
        "title": "Melhorias visuais",
        "sections": {
            "novidades": [
                "Melhorias visuais no mapa e na barra superior.",
                "Carimbo de celebração 'EQUIPA DESTACADA' ao despachar equipas.",
                "Ecrãs de arranque revistos.",
            ],
            "melhorias": [
                "Feedback visual melhorado nos botões.",
                "Notificações visuais mais claras.",
                "Cabeçalhos dos painéis revistos.",
            ],
            "interface": [
                "Cartões, seletores, interruptores e barras de progresso revistos.",
                "Animações da interface e marcadores ajustadas.",
                "Suporte completo a prefers-reduced-motion em todas as animações.",
            ],
        },
    },
    {
        "version": "0.4.0",
        "date": "2026-07-03",
        "title": "Interface e informação",
        "sections": {
            "novidades": [
                "Barra de recursos com fluxos passivos €/h, estado do calor e countdown de salários.",
                "Legenda do mapa colapsável e tooltips em todos os marcadores.",
                "Relatórios com fortuna total, valor da frota e alertas da organização.",
            ],
            "melhorias": [
                "Indicadores nos botões do HUD para avarias, missões por reclamar e alertas de RH.",
                "Resumos nos painéis de Equipas, RH, Frota e Imóveis.",
                "Autonomia em km visível por veículo e impacto salarial ao contratar.",
            ],
            "interface": [
                "Tooltips CSS nativos em toda a interface.",
                "Feed de atividade com tempo relativo.",
            ],
        },
    },
    {
        "version": "0.3.0",
        "date": "2026-07-02",
        "title": "Efetivo",
        "sections": {
            "novidades": [
                "14 especializações de funcionários, 6 delas com passivos de organização.",
                "9 atributos, 4 raridades (comum a lendário) e 8 talentos únicos aplicados em missões.",
                "7 ranks com promoções pagas, do recruta ao braço-direito.",
                "Recrutamento por 6 fontes desbloqueadas por nível, com pool renovada a cada 5 minutos.",
                "9 formações de treino com bónus por especialização.",
            ],
            "melhorias": [
                "Painel de RH reformulado com tabs Plantel/Recrutar e cartões detalhados.",
                "Histórico individual por funcionário e progressão de XP/nível.",
            ],
            "equilibrio": [
                "Lealdade, moral e fadiga com folha salarial a cada 30 minutos.",
                "Traições (roubo, fuga de informação, sabotagem, abandono) com risco exposto na interface.",
                "Estados: em missão, em treino, a descansar, ferido e preso — cada um com resolução própria.",
            ],
            "economia": [
                "Salários em função da especialização, raridade e rank.",
                "Bónus pagos para recuperar moral; custos de clínica e de libertação.",
            ],
        },
    },
    {
        "version": "0.2.0",
        "date": "2026-06-30",
        "title": "Frota e Império Imobiliário",
        "sections": {
            "novidades": [
                "6 veículos com combustível, desgaste, reparações e atribuição a equipas.",
                "7 tipos de propriedades: esconderijo, garagem, empresa de fachada, armazém, porto, laboratório e oficina.",
                "Upgrades de propriedades até nível 3.",
            ],
            "equilibrio": [
                "Rusgas policiais quando o calor atinge 70 ou mais.",
            ],
            "economia": [
                "Lavagem passiva de dinheiro através de empresas de fachada.",
                "Produção de dinheiro sujo no laboratório (com aumento de calor).",
                "Desconto de reparações através da oficina.",
            ],
        },
    },
    {
        "version": "0.1.0",
        "date": "2026-06-28",
        "title": "Temporada 0 — O Nascimento de SUBMUNDO",
        "sections": {
            "novidades": [
                "Mapa vivo de Lisboa com 16 zonas e QG no Cais do Sodré.",
                "11 tipos de oportunidades criminosas em tempo real, com gate por nível.",
                "4 especializações de equipas com bónus de compatibilidade.",
                "Unidades a mover-se em tempo real no mapa, com fases de viagem e execução.",
                "Contas com autenticação JWT e proteção contra força bruta.",
            ],
            "economia": [
                "Economia dupla: dinheiro limpo e dinheiro sujo, com lavagem manual.",
                "Sistema de respeito com 10 níveis de progressão.",
                "Calor policial com decaimento gradual.",
            ],
            "interface": [
                "Dashboard escura mobile-first com mapa fullscreen e menus flutuantes.",
                "Feed de atividade em tempo real.",
            ],
        },
    },
]

CHANGELOG_CATEGORIES = {
    "novidades": "Novidades",
    "melhorias": "Melhorias",
    "correcoes": "Correções",
    "equilibrio": "Equilíbrio",
    "economia": "Economia",
    "interface": "Interface",
}

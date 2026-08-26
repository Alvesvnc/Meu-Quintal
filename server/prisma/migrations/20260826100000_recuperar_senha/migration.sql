-- Recuperar senha: o mesmo link de uso unico do primeiro acesso, agora
-- servindo tambem quem esqueceu a senha — e tambem usuario de COZINHA.

CREATE TYPE "AccessTokenKind" AS ENUM ('primeiro-acesso', 'recuperar-senha');

-- `kind` entra COM default porque a coluna e NOT NULL e pode haver linha
-- viva: todo link que existe hoje e de primeiro acesso. O default sai logo
-- depois — daqui pra frente quem cria um link diz pra que ele serve.
ALTER TABLE "access_tokens"
  ADD COLUMN "kind" "AccessTokenKind" NOT NULL DEFAULT 'primeiro-acesso';
ALTER TABLE "access_tokens" ALTER COLUMN "kind" DROP DEFAULT;

-- O link passa a poder apontar pra um usuario de cozinha. `userId` deixa de
-- ser obrigatorio, e o CHECK abaixo garante que exatamente UM dos dois esta
-- preenchido — sem ele, "nenhum dos dois" viraria um link orfao que nunca
-- troca senha nenhuma, e "os dois" seria ambiguidade silenciosa.
ALTER TABLE "access_tokens" ADD COLUMN "kitchenUserId" UUID;
ALTER TABLE "access_tokens" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "access_tokens"
  ADD CONSTRAINT "access_tokens_um_dono_so"
  CHECK (("userId" IS NULL) <> ("kitchenUserId" IS NULL));

CREATE INDEX "access_tokens_kitchenUserId_idx" ON "access_tokens"("kitchenUserId");

ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_kitchenUserId_fkey"
  FOREIGN KEY ("kitchenUserId") REFERENCES "kitchen_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Versao do token: sobe a cada troca de senha e invalida todo JWT emitido
-- antes. Sem isto, trocar a senha nao expulsa ninguem — o token e stateless e
-- vale 7 dias, entao quem trocasse a senha por desconfiar de invasao
-- continuaria com o invasor dentro.
ALTER TABLE "account_users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "kitchen_users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

using Microsoft.Xna.Framework;
using Terraria;
using Terraria.ModLoader;

namespace WikiStarter.Content.Players
{
    public class GodslayerPlayer : ModPlayer
    {
        public int DivineWaveCooldown;
        private int bossIntroTicks;
        private int bossIntroNpc = -1;

        public override void PostUpdate()
        {
            if (DivineWaveCooldown > 0)
                DivineWaveCooldown--;
        }

        public void BeginBossIntro(int npcIndex, int duration)
        {
            bossIntroNpc = npcIndex;
            bossIntroTicks = duration;
        }

        public override void ModifyScreenPosition()
        {
            if (bossIntroTicks <= 0 || bossIntroNpc < 0 || bossIntroNpc >= Main.maxNPCs)
                return;

            NPC boss = Main.npc[bossIntroNpc];
            if (!boss.active)
            {
                bossIntroTicks = 0;
                bossIntroNpc = -1;
                return;
            }

            Vector2 focus = bossIntroTicks > 30
                ? Vector2.Lerp(Player.Center, boss.Center, 0.58f)
                : Player.Center;
            Vector2 targetScreen = focus - new Vector2(Main.screenWidth * 0.5f, Main.screenHeight * 0.5f);
            Main.screenPosition = Vector2.Lerp(Main.screenPosition, targetScreen, 0.12f);

            bossIntroTicks--;
            if (bossIntroTicks == 0)
                bossIntroNpc = -1;
        }
    }
}

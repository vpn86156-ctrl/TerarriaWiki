using Microsoft.Xna.Framework;
using Terraria;
using Terraria.ID;
using Terraria.ModLoader;
using WikiStarter.Content.Items;
using WikiStarter.Content.Systems;

namespace WikiStarter.Content.Players
{
    public class GodslayerPlayer : ModPlayer
    {
        public int DivineWaveCooldown;

        public override void PostUpdate()
        {
            if (DivineWaveCooldown > 0)
                DivineWaveCooldown--;

            AddGreatswordFlameTrail();
        }

        public void BeginBossIntro(int npcIndex, int duration, int sceneStyle = 0)
        {
            FallenGodCutsceneSystem.Begin(npcIndex, duration, sceneStyle);
        }

        private void AddGreatswordFlameTrail()
        {
            if (Main.netMode == NetmodeID.Server || Player.itemAnimation <= 0 || Player.itemAnimationMax <= 0)
                return;
            if (Player.HeldItem.type != ModContent.ItemType<FallenGodsFlame>() || Player.itemAnimation % 3 != 0)
                return;

            float progress = MathHelper.Clamp(1f - Player.itemAnimation / (float)Player.itemAnimationMax, 0f, 1f);
            progress = progress * progress * (3f - 2f * progress);
            for (int i = 0; i < 2; i++)
            {
                float arc = MathHelper.Lerp(-1.9f, 1.15f, MathHelper.Clamp(progress + i * 0.07f, 0f, 1f));
                Vector2 offset = new Vector2(48f * Player.direction, 0f).RotatedBy(arc * Player.direction);
                Vector2 position = Player.MountedCenter + offset;
                int dustIndex = Dust.NewDust(position, 5, 5, DustID.Torch, 0f, 0f, 80, new Color(255, 125, 25), 1.45f);
                Dust dust = Main.dust[dustIndex];
                dust.velocity = new Vector2(-offset.Y, offset.X).SafeNormalize(Vector2.Zero) * 2.4f;
                dust.noGravity = true;
            }
        }
    }
}

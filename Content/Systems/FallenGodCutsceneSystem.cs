using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Terraria;
using Terraria.GameContent;
using Terraria.Localization;
using Terraria.ModLoader;

namespace WikiStarter.Content.Systems
{
    public class FallenGodCutsceneSystem : ModSystem
    {
        private static int bossIndex = -1;
        private static int ticksLeft;
        private static int elapsedTicks;

        public static void Begin(int npcIndex, int duration)
        {
            bossIndex = npcIndex;
            ticksLeft = duration;
            elapsedTicks = 0;

            if (Main.netMode != Terraria.ID.NetmodeID.Server && Main.LocalPlayer.active)
                Main.instance.CameraModifiers.Add(new FallenGodCameraModifier(npcIndex, duration));
        }

        public override void PostDrawInterface(SpriteBatch spriteBatch)
        {
            if (ticksLeft <= 0)
                return;

            float fadeIn = MathHelper.Clamp(elapsedTicks / 16f, 0f, 1f);
            float fadeOut = MathHelper.Clamp(ticksLeft / 16f, 0f, 1f);
            float opacity = System.Math.Min(fadeIn, fadeOut);
            int barHeight = (int)(Main.screenHeight * 0.075f * opacity);
            if (barHeight <= 0)
                return;

            Texture2D backdrop = ModContent.Request<Texture2D>("WikiStarter/Content/Systems/FallenGodCutsceneBackdrop").Value;
            spriteBatch.Draw(backdrop, new Rectangle(0, 0, Main.screenWidth, Main.screenHeight),
                Color.White * (opacity * 0.28f));

            Texture2D pixel = TextureAssets.MagicPixel.Value;
            Color barColor = Color.Black * opacity;
            spriteBatch.Draw(pixel, new Rectangle(0, 0, Main.screenWidth, barHeight), barColor);
            spriteBatch.Draw(pixel, new Rectangle(0, Main.screenHeight - barHeight, Main.screenWidth, barHeight), barColor);

            if (elapsedTicks > 12 && ticksLeft > 18)
            {
                string title = Language.GetTextValue("Mods.WikiStarter.NPCs.FallenGod.DisplayName").ToUpperInvariant();
                Vector2 titleSize = FontAssets.DeathText.Value.MeasureString(title);
                Utils.DrawBorderStringFourWay(spriteBatch, FontAssets.DeathText.Value, title,
                    Main.screenWidth * 0.5f, barHeight * 0.42f,
                    new Color(255, 205, 95) * opacity, Color.Black, titleSize * 0.5f, 0.62f);
            }
        }

        public override void PostUpdateEverything()
        {
            if (ticksLeft <= 0)
                return;

            if (bossIndex < 0 || bossIndex >= Main.maxNPCs || !Main.npc[bossIndex].active)
            {
                End();
                return;
            }

            ticksLeft--;
            elapsedTicks++;
            if (ticksLeft == 0)
                End();
        }

        public override void ClearWorld() => End();

        private static void End()
        {
            bossIndex = -1;
            ticksLeft = 0;
            elapsedTicks = 0;
        }
    }
}

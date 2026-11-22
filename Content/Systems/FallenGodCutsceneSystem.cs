using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Terraria;
using Terraria.GameContent;
using Terraria.Localization;
using Terraria.Graphics.Effects;
using Terraria.ModLoader;
using WikiStarter.Content.NPCs;

namespace WikiStarter.Content.Systems
{
    public class FallenGodCutsceneSystem : ModSystem
    {
        private static int bossIndex = -1;
        private static int ticksLeft;
        private static int elapsedTicks;
        private static int sceneStyle;
        private static float hellIntensity;
        private static float deathFlash;

        public override void OnModLoad()
        {
            if (!Main.dedServ)
                SkyManager.Instance[FallenGodHellSkyEffect.SkyKey] = new FallenGodHellSkyEffect();
        }

        public override void OnModUnload()
        {
            if (!Main.dedServ)
                SkyManager.Instance.Deactivate(FallenGodHellSkyEffect.SkyKey);
        }

        public static void Begin(int npcIndex, int duration, int style = 0)
        {
            bossIndex = npcIndex;
            ticksLeft = duration;
            elapsedTicks = 0;
            sceneStyle = style;

            if (Main.netMode != Terraria.ID.NetmodeID.Server && Main.LocalPlayer.active)
                Main.instance.CameraModifiers.Add(new FallenGodCameraModifier(npcIndex, duration));
        }

        public static void TriggerDeathFlash()
        {
            deathFlash = 0.88f;
        }

        public override void ModifySunLightColor(ref Color tileColor, ref Color backgroundColor)
        {
            if (hellIntensity <= 0.001f)
                return;

            tileColor = Color.Lerp(tileColor, new Color(255, 92, 46), 0.32f * hellIntensity);
            backgroundColor = Color.Lerp(backgroundColor, new Color(75, 7, 20), 0.62f * hellIntensity);
        }

        public override void ModifyLightingBrightness(ref float scale)
        {
            scale *= 1f - 0.12f * hellIntensity;
        }

        public override void PostDrawInterface(SpriteBatch spriteBatch)
        {
            Rectangle screen = new Rectangle(0, 0, Main.screenWidth, Main.screenHeight);
            if (ticksLeft > 0)
            {
                float fadeIn = MathHelper.Clamp(elapsedTicks / 18f, 0f, 1f);
                float fadeOut = MathHelper.Clamp(ticksLeft / 20f, 0f, 1f);
                float opacity = System.Math.Min(fadeIn, fadeOut);
                int barHeight = (int)(Main.screenHeight * 0.075f * opacity);

                if (sceneStyle == 0)
                {
                    Texture2D intro = ModContent.Request<Texture2D>("WikiStarter/Content/Systems/FallenGodCutsceneBackdrop").Value;
                    spriteBatch.Draw(intro, screen, Color.White * (opacity * 0.2f));
                }
                else if (sceneStyle == 1)
                {
                    Texture2D returnArt = ModContent.Request<Texture2D>("WikiStarter/Content/Systems/FallenGodPhaseReturn").Value;
                    spriteBatch.Draw(returnArt, screen, Color.White * (opacity * 0.2f));
                }
                else
                {
                    Texture2D deathArt = ModContent.Request<Texture2D>("WikiStarter/Content/Systems/FallenGodDeathVortex").Value;
                    spriteBatch.Draw(deathArt, screen, Color.White * (opacity * 0.28f));
                }

                Texture2D pixel = TextureAssets.MagicPixel.Value;
                Color barColor = Color.Black * opacity;
                spriteBatch.Draw(pixel, new Rectangle(0, 0, Main.screenWidth, barHeight), barColor);
                spriteBatch.Draw(pixel, new Rectangle(0, Main.screenHeight - barHeight, Main.screenWidth, barHeight), barColor);

                if (elapsedTicks > 12 && ticksLeft > 18 && barHeight > 0)
                {
                    string key = sceneStyle == 2
                        ? "Mods.WikiStarter.Cutscenes.FallenGodDeath"
                        : sceneStyle == 1
                            ? "Mods.WikiStarter.Cutscenes.FallenGodReturn"
                            : "Mods.WikiStarter.NPCs.FallenGod.DisplayName";
                    string title = Language.GetTextValue(key).ToUpperInvariant();
                    Vector2 titleSize = FontAssets.DeathText.Value.MeasureString(title);
                    Utils.DrawBorderStringFourWay(spriteBatch, FontAssets.DeathText.Value, title,
                        Main.screenWidth * 0.5f, barHeight * 0.42f,
                        new Color(255, 211, 112) * opacity, Color.Black, titleSize * 0.5f, 0.62f);
                }
            }

            if (deathFlash > 0.005f)
            {
                Texture2D pixel = TextureAssets.MagicPixel.Value;
                spriteBatch.Draw(pixel, screen, new Color(255, 230, 180) * deathFlash);
            }
        }

        public override void PostUpdateEverything()
        {
            UpdateHellIntensity();
            deathFlash = System.Math.Max(0f, deathFlash - 0.075f);

            if (ticksLeft <= 0)
                return;

            if ((bossIndex < 0 || bossIndex >= Main.maxNPCs || !Main.npc[bossIndex].active) && sceneStyle != 2)
            {
                EndScene();
                return;
            }

            ticksLeft--;
            elapsedTicks++;
            if (ticksLeft == 0)
                EndScene();
        }

        public override void OnWorldUnload()
        {
            ClearWorld();
        }

        public override void ClearWorld()
        {
            EndScene();
            hellIntensity = 0f;
            deathFlash = 0f;
            if (!Main.dedServ)
                SkyManager.Instance.Deactivate(FallenGodHellSkyEffect.SkyKey);
        }

        private static void UpdateHellIntensity()
        {
            bool infernalReturn = false;
            int bossType = ModContent.NPCType<FallenGod>();
            for (int i = 0; i < Main.maxNPCs; i++)
            {
                NPC npc = Main.npc[i];
                if (npc.active && npc.type == bossType && (npc.life <= npc.lifeMax / 5 || npc.ai[3] >= 6f))
                {
                    infernalReturn = true;
                    break;
                }
            }

            if (!Main.dedServ)
            {
                if (infernalReturn)
                    SkyManager.Instance.Activate(FallenGodHellSkyEffect.SkyKey, Vector2.Zero);
                else
                    SkyManager.Instance.Deactivate(FallenGodHellSkyEffect.SkyKey);
            }

            float target = infernalReturn ? 1f : 0f;
            float step = infernalReturn ? 0.012f : 0.025f;
            if (hellIntensity < target)
                hellIntensity = System.Math.Min(target, hellIntensity + step);
            else if (hellIntensity > target)
                hellIntensity = System.Math.Max(target, hellIntensity - step);
        }

        private static void EndScene()
        {
            bossIndex = -1;
            ticksLeft = 0;
            elapsedTicks = 0;
            sceneStyle = 0;
        }
    }
}

using Microsoft.Xna.Framework;
using Terraria;
using Terraria.Graphics.CameraModifiers;

namespace WikiStarter.Content.Systems
{
    /// <summary>Three-beat pan: ease onto the boss, hold the reveal, then return to the player.</summary>
    public sealed class FallenGodCameraModifier : ICameraModifier
    {
        private readonly int npcIndex;
        private readonly int duration;
        private readonly Vector2 startingCameraPosition;
        private int elapsed;

        public string UniqueIdentity { get; private set; }
        public bool Finished { get; private set; }

        public FallenGodCameraModifier(int npcIndex, int duration)
        {
            this.npcIndex = npcIndex;
            this.duration = System.Math.Max(1, duration);
            startingCameraPosition = Main.screenPosition;
            UniqueIdentity = $"WikiStarter:FallenGodIntro:{npcIndex}";
        }

        public void Update(ref CameraInfo cameraInfo)
        {
            if (Finished || Main.gameInactive || Main.gamePaused)
                return;

            Player player = Main.LocalPlayer;
            Vector2 screenHalf = new Vector2(Main.screenWidth * 0.5f, Main.screenHeight * 0.5f);
            Vector2 playerPosition = ClampScreenPosition(player.Center - screenHalf);

            if (!player.active || npcIndex < 0 || npcIndex >= Main.maxNPCs || !Main.npc[npcIndex].active)
            {
                cameraInfo.CameraPosition = Vector2.Lerp(cameraInfo.CameraPosition, playerPosition, 0.16f);
                if (Vector2.DistanceSquared(cameraInfo.CameraPosition, playerPosition) < 2f)
                    Finished = true;
                return;
            }

            NPC boss = Main.npc[npcIndex];
            Vector2 focus = Vector2.Lerp(player.Center, boss.Center, 0.78f);
            Vector2 bossPosition = ClampScreenPosition(focus - screenHalf);
            float progress = elapsed / (float)duration;

            if (progress < 0.42f)
            {
                float pan = MathHelper.SmoothStep(0f, 1f, progress / 0.42f);
                cameraInfo.CameraPosition = Vector2.Lerp(startingCameraPosition, bossPosition, pan);
            }
            else if (progress < 0.72f)
            {
                cameraInfo.CameraPosition = Vector2.Lerp(cameraInfo.CameraPosition, bossPosition, 0.18f);
            }
            else
            {
                float returnProgress = MathHelper.SmoothStep(0f, 1f, (progress - 0.72f) / 0.28f);
                cameraInfo.CameraPosition = Vector2.Lerp(bossPosition, playerPosition, returnProgress);
            }

            elapsed++;
            if (elapsed >= duration)
                Finished = true;
        }

        private static Vector2 ClampScreenPosition(Vector2 position)
        {
            Vector2 max = new Vector2(
                System.Math.Max(0, Main.maxTilesX * 16 - Main.screenWidth),
                System.Math.Max(0, Main.maxTilesY * 16 - Main.screenHeight));
            return Vector2.Clamp(position, Vector2.Zero, max);
        }
    }
}

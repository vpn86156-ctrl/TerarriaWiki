using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Terraria;
using Terraria.GameContent;
using Terraria.ID;
using Terraria.ModLoader;

namespace WikiStarter.Content.Projectiles
{
    public class GodfireBolt : ModProjectile
    {
        public override void SetStaticDefaults()
        {
            Main.projFrames[Type] = 3;
            ProjectileID.Sets.TrailCacheLength[Type] = 8;
            ProjectileID.Sets.TrailingMode[Type] = 0;
        }

        public override void SetDefaults()
        {
            Projectile.width = 38;
            Projectile.height = 30;
            Projectile.hostile = true;
            Projectile.friendly = false;
            Projectile.penetrate = 1;
            Projectile.timeLeft = 180;
            Projectile.tileCollide = true;
            Projectile.ignoreWater = true;
        }

        public override void AI()
        {
            if (Projectile.ai[0] == 1f)
            {
                Projectile.velocity.Y = System.Math.Min(Projectile.velocity.Y + 0.12f, 13f);
                Projectile.velocity.X *= 0.998f;
            }

            Projectile.rotation = Projectile.velocity.ToRotation();
            Projectile.frameCounter++;
            if (Projectile.frameCounter >= 4)
            {
                Projectile.frameCounter = 0;
                Projectile.frame = (Projectile.frame + 1) % Main.projFrames[Type];
            }

            Lighting.AddLight(Projectile.Center, 0.9f, 0.26f, 0.04f);
            if (Main.rand.NextBool(3))
            {
                int dustIndex = Dust.NewDust(Projectile.position, Projectile.width, Projectile.height, DustID.Torch);
                Main.dust[dustIndex].velocity *= 0.2f;
                Main.dust[dustIndex].noGravity = true;
            }
        }

        public override bool PreDraw(ref Color lightColor)
        {
            Texture2D texture = TextureAssets.Projectile[Type].Value;
            int frameHeight = texture.Height / Main.projFrames[Type];
            Rectangle frame = new Rectangle(0, frameHeight * Projectile.frame, texture.Width, frameHeight);
            Vector2 origin = new Vector2(frame.Width * 0.5f, frame.Height * 0.5f);

            for (int i = Projectile.oldPos.Length - 1; i >= 0; i--)
            {
                if (Projectile.oldPos[i] == Vector2.Zero)
                    continue;

                float fade = (Projectile.oldPos.Length - i) / (float)Projectile.oldPos.Length;
                Color trailColor = Color.Lerp(new Color(150, 28, 10), new Color(255, 170, 50), fade) * (fade * 0.55f);
                Vector2 trailPosition = Projectile.oldPos[i] + Projectile.Size * 0.5f - Main.screenPosition;
                Main.EntitySpriteDraw(texture, trailPosition, frame, trailColor, Projectile.oldRot[i], origin,
                    Projectile.scale * MathHelper.Lerp(0.45f, 0.9f, fade), SpriteEffects.None, 0f);
            }

            Main.EntitySpriteDraw(texture, Projectile.Center - Main.screenPosition, frame, Projectile.GetAlpha(lightColor),
                Projectile.rotation, origin, Projectile.scale, SpriteEffects.None, 0f);
            return false;
        }

        public override void OnHitPlayer(Player target, Player.HurtInfo info)
        {
            target.AddBuff(BuffID.OnFire, 240);
        }
    }
}

using Microsoft.Xna.Framework;
using Terraria;
using Terraria.Audio;
using Terraria.DataStructures;
using Terraria.GameContent.ItemDropRules;
using Terraria.Graphics.CameraModifiers;
using Terraria.ID;
using Terraria.ModLoader;
using WikiStarter.Content.Items;
using WikiStarter.Content.Players;
using WikiStarter.Content.Projectiles;
using WikiStarter.Content.UI;

namespace WikiStarter.Content.NPCs
{
    [AutoloadBossHead]
    public class FallenGod : ModNPC
    {
        private static readonly SoundStyle AwakeningSound = new SoundStyle("WikiStarter/Sounds/FallenGodAwakening")
        {
            Volume = 0.9f,
            PitchVariance = 0.04f
        };

        private static readonly SoundStyle SlamSound = new SoundStyle("WikiStarter/Sounds/FallenGodSlam")
        {
            Volume = 1f,
            PitchVariance = 0.04f
        };

        public override void SetStaticDefaults()
        {
            Main.npcFrameCount[Type] = 9;
            NPCID.Sets.MPAllowedEnemies[Type] = true;
            NPCID.Sets.BossBestiaryPriority.Add(Type);
        }

        public override void SetDefaults()
        {
            NPC.width = 128;
            NPC.height = 184;
            NPC.scale = 1.3f;
            NPC.damage = 42;
            NPC.defense = 15;
            NPC.lifeMax = 7000;
            NPC.value = Item.buyPrice(gold: 8);
            NPC.knockBackResist = 0f;
            NPC.boss = true;
            NPC.BossBar = ModContent.GetInstance<FallenGodBossBar>();
            NPC.noGravity = true;
            NPC.noTileCollide = true;
            NPC.lavaImmune = true;
            NPC.aiStyle = -1;
            NPC.npcSlots = 10f;
            NPC.HitSound = SoundID.NPCHit4;
            NPC.DeathSound = SoundID.NPCDeath14;
            NPC.buffImmune[BuffID.OnFire] = true;
            Music = MusicID.Boss3;
        }

        public override void OnSpawn(IEntitySource source)
        {
            NPC.TargetClosest(false);
            if (NPC.target >= 0 && NPC.target < Main.maxPlayers && Main.player[NPC.target].active)
            {
                Player target = Main.player[NPC.target];
                NPC.Center = target.Center + new Vector2(target.direction * 230f, -180f);
            }

            NPC.ai[2] = 0f;
            NPC.ai[3] = 5f; // dramatic entrance
            NPC.alpha = 255;
            NPC.dontTakeDamage = true;
            NPC.netUpdate = true;
        }

        public override void FindFrame(int frameHeight)
        {
            int frame = 0;
            if (NPC.ai[3] == 1f)
                frame = 1; // jump wind-up
            else if (NPC.ai[3] == 2f)
                frame = 2; // rise
            else if (NPC.ai[3] == 3f)
                frame = 3; // descent
            else if (NPC.ai[3] == 6f)
                frame = 8; // final transformation
            else if (NPC.ai[3] == 0f && NPC.localAI[0] > 12f)
                frame = 6; // gather a fireball
            else if (NPC.ai[3] == 0f && NPC.localAI[0] > 0f)
                frame = 7; // release the fireball
            else if (NPC.ai[3] == 0f && System.Math.Abs(NPC.velocity.X) > 2.2f)
                frame = 4; // keep the matching horizontal-flight pose; switching to the upright pose looked like a flicker

            NPC.frame.Y = frameHeight * frame;
        }

        public override void AI()
        {
            NPC.TargetClosest();
            Player target = Main.player[NPC.target];

            if (!target.active || target.dead)
            {
                NPC.velocity.Y -= 0.2f;
                if (NPC.timeLeft > 10)
                    NPC.timeLeft = 10;
                return;
            }

            if (NPC.ai[3] == 5f)
            {
                RunEntrance();
                return;
            }

            bool finalPhase = NPC.life <= NPC.lifeMax / 5;
            if (finalPhase && NPC.localAI[2] == 0f)
            {
                NPC.localAI[2] = 1f;
                NPC.ai[0] = 0f;
                NPC.ai[1] = 0f;
                NPC.ai[2] = 0f;
                NPC.ai[3] = 6f;
                NPC.localAI[0] = 0f;
                NPC.velocity = Vector2.Zero;
                NPC.netUpdate = true;
            }

            if (NPC.ai[3] == 6f)
            {
                RunFinalTransformation();
                return;
            }

            if (NPC.localAI[0] > 0f)
                NPC.localAI[0]--;

            bool enraged = NPC.life < NPC.lifeMax / 2;
            NPC.damage = finalPhase ? 38 : enraged ? 48 : 42;
            NPC.defense = finalPhase ? 18 : enraged ? 20 : 15;
            NPC.direction = target.Center.X >= NPC.Center.X ? 1 : -1;
            NPC.spriteDirection = NPC.direction;
            NPC.noTileCollide = NPC.ai[3] != 3f;
            if (NPC.ai[3] == 0f)
            {
                float bank = MathHelper.Clamp(NPC.velocity.X * 0.004f, -0.045f, 0.045f);
                NPC.rotation = MathHelper.Lerp(NPC.rotation, bank, 0.08f);
            }
            else
            {
                NPC.rotation = MathHelper.Lerp(NPC.rotation, 0f, 0.12f);
            }

            if (NPC.ai[3] == 0f)
            {
                // Keep the boss close; reduced final-phase tracking leaves a clearer opening to dodge.
                float horizontalOffset = finalPhase ? 82f : enraged ? 84f : 112f;
                float verticalOffset = finalPhase ? -48f : enraged ? -60f : -86f;
                float flightSpeed = finalPhase ? 7.3f : enraged ? 7.8f : 7.5f;
                float tracking = finalPhase ? 0.06f : enraged ? 0.07f : 0.075f;
                Vector2 hoverPoint = target.Center + new Vector2(-NPC.direction * horizontalOffset, verticalOffset);
                Vector2 desiredVelocity = (hoverPoint - NPC.Center).SafeNormalize(Vector2.Zero) * flightSpeed;
                NPC.velocity = Vector2.Lerp(NPC.velocity, desiredVelocity, tracking);

                if (NPC.ai[1] > 0f)
                {
                    NPC.ai[1]--;
                    if (NPC.ai[1] == 7f && Main.netMode != NetmodeID.MultiplayerClient)
                    {
                        if (finalPhase && Main.rand.NextBool(2))
                            FireCrescentVolley(target);
                        else
                            FireFan(target, enraged, finalPhase);
                    }
                }
                else
                {
                    NPC.ai[0]++;
                    int shotInterval = finalPhase ? 62 : enraged ? 62 : 82;
                    if (NPC.ai[0] >= shotInterval)
                    {
                        NPC.ai[0] = 0f;
                        NPC.ai[1] = 24f;
                        NPC.localAI[0] = 24f;
                        NPC.netUpdate = true;
                    }
                }

                if (enraged)
                {
                    NPC.ai[2]++;
                    float jumpInterval = finalPhase ? 240f : 260f;
                    if (NPC.ai[2] >= jumpInterval && NPC.ai[1] <= 0f)
                    {
                        NPC.ai[2] = 0f;
                        NPC.ai[3] = 1f;
                        NPC.localAI[0] = 0f;
                        NPC.velocity *= 0.45f;
                        NPC.netUpdate = true;
                    }
                }
                else
                {
                    NPC.ai[2] = 0f;
                }

                if (finalPhase)
                {
                    NPC.localAI[1]++;
                    if (NPC.localAI[1] >= 300f)
                    {
                        NPC.localAI[1] = 0f;
                        if (Main.netMode != NetmodeID.MultiplayerClient)
                            FireMeteorRain(target);
                    }
                }
                else
                {
                    NPC.localAI[1] = 0f;
                }
            }
            else
            {
                RunJumpSlam(target, finalPhase);
            }
        }

        private void RunFinalTransformation()
        {
            NPC.dontTakeDamage = true;
            NPC.damage = 0;
            NPC.noTileCollide = true;
            NPC.velocity *= 0.82f;
            NPC.ai[2]++;
            NPC.alpha = NPC.ai[2] < 75f ? System.Math.Max(0, 180 - (int)(NPC.ai[2] * 2.4f)) : 0;
            Lighting.AddLight(NPC.Center, 1.1f, 0.32f, 0.06f);

            if (NPC.ai[2] == 1f && Main.netMode != NetmodeID.Server)
            {
                SoundEngine.PlaySound(AwakeningSound, NPC.Center);
                ShakeCamera(9f);
                if (Main.LocalPlayer.active)
                    Main.LocalPlayer.GetModPlayer<GodslayerPlayer>().BeginBossIntro(NPC.whoAmI, 210);
            }

            if (NPC.ai[2] % 6f == 0f)
                SpawnEntranceEmbers();

            if (NPC.ai[2] >= 150f)
            {
                NPC.ai[2] = 0f;
                NPC.ai[3] = 0f;
                NPC.alpha = 0;
                NPC.dontTakeDamage = false;
                NPC.netUpdate = true;
                SpawnEntranceEmbers();
                if (Main.netMode != NetmodeID.Server)
                {
                    SoundEngine.PlaySound(SlamSound, NPC.Center);
                    ShakeCamera(17f);
                }
            }
        }

        private void RunEntrance()
        {
            NPC.dontTakeDamage = true;
            NPC.damage = 0;
            NPC.noTileCollide = true;
            NPC.velocity *= 0.8f;
            NPC.ai[2]++;

            if (NPC.localAI[3] == 0f)
            {
                NPC.localAI[3] = 1f;
                if (Main.netMode != NetmodeID.Server)
                {
                    SoundEngine.PlaySound(AwakeningSound, NPC.Center);
                    if (Main.LocalPlayer.active)
                        Main.LocalPlayer.GetModPlayer<GodslayerPlayer>().BeginBossIntro(NPC.whoAmI, 180);
                }
            }

            NPC.alpha = System.Math.Max(0, 255 - (int)(NPC.ai[2] * 6f));
            if (NPC.ai[2] % 7f == 0f)
                SpawnEntranceEmbers();

            if (NPC.ai[2] == 46f && Main.netMode != NetmodeID.Server)
            {
                SoundEngine.PlaySound(SlamSound, NPC.Center);
                ShakeCamera(14f);
            }

            if (NPC.ai[2] >= 82f)
            {
                NPC.ai[2] = 0f;
                NPC.ai[3] = 0f;
                NPC.alpha = 0;
                NPC.dontTakeDamage = false;
                NPC.netUpdate = true;
            }
        }

        private void ShakeCamera(float strength)
        {
            if (Main.netMode == NetmodeID.Server || Main.LocalPlayer == null || !Main.LocalPlayer.active)
                return;

            PunchCameraModifier punch = new PunchCameraModifier(NPC.Center, Vector2.UnitY, strength, 6f, 18, 900f, "WikiStarter:FallenGod");
            Main.instance.CameraModifiers.Add(punch);
        }

        private void SpawnEntranceEmbers()
        {
            for (int i = 0; i < 10; i++)
            {
                int dustIndex = Dust.NewDust(NPC.position, NPC.width, NPC.height, DustID.Torch);
                Vector2 direction = (Main.dust[dustIndex].position - NPC.Center).SafeNormalize(Vector2.UnitY);
                Main.dust[dustIndex].velocity = direction * Main.rand.NextFloat(2f, 6f);
                Main.dust[dustIndex].noGravity = true;
                Main.dust[dustIndex].scale = Main.rand.NextFloat(1.2f, 2.2f);
            }
        }

        private void RunJumpSlam(Player target, bool finalPhase)
        {
            NPC.ai[2]++;
            float horizontalAim = MathHelper.Clamp((target.Center.X - NPC.Center.X) * 0.025f, -7f, 7f);

            switch ((int)NPC.ai[3])
            {
                case 1: // wind-up
                    NPC.velocity *= 0.72f;
                    if (NPC.ai[2] >= 16f)
                    {
                        NPC.ai[2] = 0f;
                        NPC.ai[3] = 2f;
                        NPC.velocity = new Vector2(horizontalAim, -13f);
                        NPC.netUpdate = true;
                    }
                    break;

                case 2: // rise
                    NPC.velocity.X = MathHelper.Lerp(NPC.velocity.X, horizontalAim, 0.12f);
                    NPC.velocity.Y = -11f;
                    if (NPC.ai[2] >= 20f)
                    {
                        NPC.ai[2] = 0f;
                        NPC.ai[3] = 3f;
                        NPC.velocity.Y = 14f;
                        NPC.noTileCollide = false;
                        NPC.netUpdate = true;
                    }
                    break;

                case 3: // descend and hit the floor near the player
                    NPC.noTileCollide = false;
                    NPC.velocity.X = MathHelper.Lerp(NPC.velocity.X, horizontalAim, 0.12f);
                    NPC.velocity.Y = 14f;
                    if (NPC.collideY || NPC.Bottom.Y >= target.Bottom.Y - 2f || NPC.ai[2] >= 42f)
                    {
                        NPC.ai[2] = 0f;
                        NPC.ai[3] = 4f;
                        NPC.velocity = Vector2.Zero;
                        NPC.noTileCollide = true;
                        if (Main.netMode != NetmodeID.MultiplayerClient)
                            FireSlamBurst(finalPhase);
                        if (Main.netMode != NetmodeID.Server)
                        {
                            SoundEngine.PlaySound(SlamSound, NPC.Center);
                            ShakeCamera(finalPhase ? 11f : 8f);
                        }
                        NPC.netUpdate = true;
                    }
                    break;

                case 4: // recovery
                    NPC.noTileCollide = true;
                    NPC.velocity *= 0.75f;
                    if (NPC.ai[2] >= 18f)
                    {
                        NPC.ai[2] = 0f;
                        NPC.ai[3] = 0f;
                        NPC.netUpdate = true;
                    }
                    break;
            }
        }

        private void FireFan(Player target, bool enraged, bool finalPhase)
        {
            Vector2 aim = (target.Center - NPC.Center).SafeNormalize(Vector2.UnitY);
            int projectileCount = finalPhase ? 5 : enraged ? 5 : 3;
            float spread = finalPhase ? 0.82f : enraged ? 0.72f : 0.48f;
            float speed = finalPhase ? 8f : enraged ? 8.5f : 7.8f;
            int damage = finalPhase ? 24 : enraged ? 30 : 22;

            for (int i = 0; i < projectileCount; i++)
            {
                float progress = projectileCount == 1 ? 0.5f : i / (float)(projectileCount - 1);
                float rotation = MathHelper.Lerp(-spread, spread, progress);
                Vector2 velocity = aim.RotatedBy(rotation) * speed;
                Projectile.NewProjectile(NPC.GetSource_FromAI(), NPC.Center, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), damage, 0f);
            }
        }

        private void FireCrescentVolley(Player target)
        {
            Vector2 aim = (target.Center - NPC.Center).SafeNormalize(Vector2.UnitY);
            Vector2 side = aim.RotatedBy(MathHelper.PiOver2);
            const int projectileCount = 5;

            for (int i = 0; i < projectileCount; i++)
            {
                float curve = i / (float)(projectileCount - 1) * 2f - 1f;
                Vector2 origin = NPC.Center + aim * (16f - System.Math.Abs(curve) * 10f) + side * curve * 22f;
                Vector2 velocity = aim.RotatedBy(curve * 0.32f) * 7f;
                Projectile.NewProjectile(NPC.GetSource_FromAI(), origin, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), 22, 0f);
            }
        }

        private void FireMeteorRain(Player target)
        {
            const int meteorCount = 5;
            for (int i = 0; i < meteorCount; i++)
            {
                float offset = (i - (meteorCount - 1) / 2f) * 112f;
                Vector2 spawnPosition = target.Center + new Vector2(offset, -360f);
                Vector2 velocity = new Vector2(-offset * 0.004f, 7.2f);
                Projectile.NewProjectile(NPC.GetSource_FromAI(), spawnPosition, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), 20, 0f);
            }
        }

        private void FireSlamBurst(bool finalPhase)
        {
            const int boltCount = 8;
            for (int i = 0; i < boltCount; i++)
            {
                float angle = MathHelper.TwoPi * i / boltCount;
                float speed = finalPhase ? 5.8f : 6.5f;
                int damage = finalPhase ? 22 : 30;
                Vector2 velocity = new Vector2((float)System.Math.Cos(angle), (float)System.Math.Sin(angle)) * speed;
                Projectile.NewProjectile(NPC.GetSource_FromAI(), NPC.Center, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), damage, 0f);
            }

            Vector2 groundPoint = NPC.Bottom - new Vector2(0f, 18f);
            float groundSpeed = finalPhase ? 7.5f : 8.5f;
            int groundDamage = finalPhase ? 22 : 32;
            Projectile.NewProjectile(NPC.GetSource_FromAI(), groundPoint, new Vector2(-groundSpeed, 0f),
                ModContent.ProjectileType<GodfireBolt>(), groundDamage, 0f);
            Projectile.NewProjectile(NPC.GetSource_FromAI(), groundPoint, new Vector2(groundSpeed, 0f),
                ModContent.ProjectileType<GodfireBolt>(), groundDamage, 0f);
        }

        public override void ModifyNPCLoot(NPCLoot npcLoot)
        {
            npcLoot.Add(ItemDropRule.Common(ModContent.ItemType<FallenGodHeart>()));
        }
    }
}

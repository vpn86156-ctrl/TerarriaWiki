using Microsoft.Xna.Framework;
using Terraria;
using Terraria.Audio;
using Terraria.DataStructures;
using Terraria.GameContent.ItemDropRules;
using Terraria.ID;
using Terraria.ModLoader;
using WikiStarter.Content.Items;
using WikiStarter.Content.Players;
using WikiStarter.Content.Projectiles;

namespace WikiStarter.Content.NPCs
{
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
        }

        public override void SetDefaults()
        {
            NPC.width = 104;
            NPC.height = 160;
            NPC.damage = 45;
            NPC.defense = 15;
            NPC.lifeMax = 7000;
            NPC.value = Item.buyPrice(gold: 8);
            NPC.knockBackResist = 0f;
            NPC.boss = true;
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
            else if (NPC.ai[3] == 0f && System.Math.Abs(NPC.velocity.X) > 1.6f)
                frame = 4 + (int)(Main.GameUpdateCount / 7 % 2); // horizontal flight cycle

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
            NPC.damage = finalPhase ? 68 : enraged ? 55 : 45;
            NPC.defense = finalPhase ? 26 : enraged ? 20 : 15;
            NPC.direction = target.Center.X >= NPC.Center.X ? 1 : -1;
            NPC.spriteDirection = NPC.direction;
            NPC.noTileCollide = NPC.ai[3] != 3f;

            if (NPC.ai[3] == 0f)
            {
                // The god now stays within striking distance and accelerates in his final phase.
                float horizontalOffset = finalPhase ? 58f : enraged ? 88f : 118f;
                float verticalOffset = finalPhase ? -48f : enraged ? -72f : -98f;
                float flightSpeed = finalPhase ? 12.5f : enraged ? 9.5f : 7.5f;
                float tracking = finalPhase ? 0.14f : 0.085f;
                Vector2 hoverPoint = target.Center + new Vector2(-NPC.direction * horizontalOffset, verticalOffset);
                Vector2 desiredVelocity = (hoverPoint - NPC.Center).SafeNormalize(Vector2.Zero) * flightSpeed;
                NPC.velocity = Vector2.Lerp(NPC.velocity, desiredVelocity, tracking);

                if (NPC.ai[1] > 0f)
                {
                    NPC.ai[1]--;
                    if (NPC.ai[1] == 7f && Main.netMode != NetmodeID.MultiplayerClient)
                        FireFan(target, enraged, finalPhase);
                }
                else
                {
                    NPC.ai[0]++;
                    int shotInterval = finalPhase ? 38 : enraged ? 55 : 82;
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
                    float jumpInterval = finalPhase ? 170f : 260f;
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
                    if (NPC.localAI[1] >= 190f)
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
                RunJumpSlam(target);
            }
        }

        private void RunFinalTransformation()
        {
            NPC.dontTakeDamage = true;
            NPC.damage = 0;
            NPC.noTileCollide = true;
            NPC.velocity *= 0.82f;
            NPC.ai[2]++;
            NPC.alpha = NPC.ai[2] % 12f < 6f ? 72 : 0;

            if (NPC.ai[2] == 1f && Main.netMode != NetmodeID.Server)
            {
                SoundEngine.PlaySound(AwakeningSound, NPC.Center);
                if (Main.LocalPlayer.active)
                    Main.LocalPlayer.GetModPlayer<GodslayerPlayer>().BeginBossIntro(NPC.whoAmI, 90);
            }

            if (NPC.ai[2] % 6f == 0f)
                SpawnEntranceEmbers();

            if (NPC.ai[2] >= 60f)
            {
                NPC.ai[2] = 0f;
                NPC.ai[3] = 0f;
                NPC.alpha = 0;
                NPC.dontTakeDamage = false;
                NPC.netUpdate = true;
                if (Main.netMode != NetmodeID.MultiplayerClient)
                    FireSlamBurst();
                if (Main.netMode != NetmodeID.Server)
                    SoundEngine.PlaySound(SlamSound, NPC.Center);
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
                        Main.LocalPlayer.GetModPlayer<GodslayerPlayer>().BeginBossIntro(NPC.whoAmI, 110);
                }
            }

            NPC.alpha = System.Math.Max(0, 255 - (int)(NPC.ai[2] * 6f));
            if (NPC.ai[2] % 7f == 0f)
                SpawnEntranceEmbers();

            if (NPC.ai[2] == 46f && Main.netMode != NetmodeID.Server)
                SoundEngine.PlaySound(SlamSound, NPC.Center);

            if (NPC.ai[2] >= 82f)
            {
                NPC.ai[2] = 0f;
                NPC.ai[3] = 0f;
                NPC.alpha = 0;
                NPC.dontTakeDamage = false;
                NPC.netUpdate = true;
            }
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

        private void RunJumpSlam(Player target)
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
                            FireSlamBurst();
                        if (Main.netMode != NetmodeID.Server)
                            SoundEngine.PlaySound(SlamSound, NPC.Center);
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
            int projectileCount = finalPhase ? 7 : enraged ? 5 : 3;
            float spread = finalPhase ? 1.05f : enraged ? 0.72f : 0.48f;
            float speed = finalPhase ? 10f : enraged ? 9f : 8f;
            int damage = finalPhase ? 42 : enraged ? 32 : 24;

            for (int i = 0; i < projectileCount; i++)
            {
                float progress = projectileCount == 1 ? 0.5f : i / (float)(projectileCount - 1);
                float rotation = MathHelper.Lerp(-spread, spread, progress);
                Vector2 velocity = aim.RotatedBy(rotation) * speed;
                Projectile.NewProjectile(NPC.GetSource_FromAI(), NPC.Center, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), damage, 0f);
            }
        }

        private void FireMeteorRain(Player target)
        {
            const int meteorCount = 7;
            for (int i = 0; i < meteorCount; i++)
            {
                float offset = (i - (meteorCount - 1) / 2f) * 92f;
                Vector2 spawnPosition = target.Center + new Vector2(offset, -440f);
                Vector2 velocity = new Vector2(-offset * 0.009f, 10.5f);
                Projectile.NewProjectile(NPC.GetSource_FromAI(), spawnPosition, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), 40, 0f);
            }
        }

        private void FireSlamBurst()
        {
            const int boltCount = 8;
            for (int i = 0; i < boltCount; i++)
            {
                float angle = MathHelper.TwoPi * i / boltCount;
                Vector2 velocity = new Vector2((float)System.Math.Cos(angle), (float)System.Math.Sin(angle)) * 7f;
                Projectile.NewProjectile(NPC.GetSource_FromAI(), NPC.Center, velocity,
                    ModContent.ProjectileType<GodfireBolt>(), 38, 0f);
            }

            Vector2 groundPoint = NPC.Bottom - new Vector2(0f, 18f);
            Projectile.NewProjectile(NPC.GetSource_FromAI(), groundPoint, new Vector2(-10f, 0f),
                ModContent.ProjectileType<GodfireBolt>(), 42, 0f);
            Projectile.NewProjectile(NPC.GetSource_FromAI(), groundPoint, new Vector2(10f, 0f),
                ModContent.ProjectileType<GodfireBolt>(), 42, 0f);
        }

        public override void ModifyNPCLoot(NPCLoot npcLoot)
        {
            npcLoot.Add(ItemDropRule.Common(ModContent.ItemType<FallenGodHeart>()));
        }
    }
}

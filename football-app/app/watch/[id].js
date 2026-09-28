import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import CompetitionLogo from "../../components/CompetitionLogo";
import TeamBadge from "../../components/TeamBadge";
import { useAppTheme } from "../../context/ThemeContext";
import {
  getOfficialMediaLinks,
  getRegionName,
  getWatchOptions,
} from "../../constants/watchHub";
import {
  getMatchCompanion,
  getWatchMatch,
  isLiveMatch,
} from "../../services/watchHub";
import {
  acceptFanTerms,
  blockFanUser,
  hasAcceptedFanTerms,
  reportFanMessage,
  sendFanMessage,
  subscribeToBlockedUsers,
  subscribeToFanMessages,
  subscribeToFanPoll,
  voteInFanPoll,
} from "../../services/fanRoom";
import { auth } from "../../services/firebase";
import { scheduleKickoffReminder } from "../../services/notifications";
import {
  PRIVACY_URL,
  TERMS_URL,
} from "../../constants/legal";

const TABS = [
  { key: "watch", label: "Watch" },
  { key: "companion", label: "Companion" },
  { key: "fans", label: "Fan room" },
];

function teamName(team) {
  return team?.shortName || team?.name || "TBC";
}

function timeLabel(date) {
  return new Date(date).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageTime(value) {
  if (!value?.toDate) return "";

  return value.toDate().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fanDisplayName(message) {
  const identifier = String(message?.userId || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6)
    .toUpperCase();

  return identifier ? `Fan ${identifier}` : "Fan";
}

function statusLabel(match) {
  if (match.status === "PAUSED") return "HALF TIME";
  if (isLiveMatch(match)) return "LIVE";
  if (match.status === "FINISHED") return "FULL TIME";
  return "UPCOMING";
}

function AvailabilityCard({
  icon,
  title,
  text,
  available,
  styles,
  theme,
}) {
  return (
    <View style={styles.availabilityCard}>
      <View style={styles.availabilityIcon}>
        <Ionicons
          name={icon}
          size={22}
          color={available ? theme.accent : theme.subText}
        />
      </View>
      <View style={styles.availabilityCopy}>
        <Text style={styles.availabilityTitle}>{title}</Text>
        <Text style={styles.availabilityText}>{text}</Text>
      </View>
      <Ionicons
        name={available ? "checkmark-circle" : "remove-circle-outline"}
        size={20}
        color={available ? "#34C759" : theme.subText}
      />
    </View>
  );
}

export default function WatchRoomScreen() {
  const { id, region = "US" } = useLocalSearchParams();
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("watch");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [fanError, setFanError] = useState("");
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());
  const [poll, setPoll] = useState({
    counts: { home: 0, draw: 0, away: 0 },
    total: 0,
    userChoice: null,
  });

  const pulse = useRef(new Animated.Value(1)).current;

  const loadMatch = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const latest = await getWatchMatch(id);
      if (latest) setMatch(latest);
    } catch (loadError) {
      console.log("WATCH ROOM ERROR:", loadError);
      setError("Verified match data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  useEffect(() => {
    if (!isLiveMatch(match)) return undefined;

    const interval = setInterval(() => loadMatch(false), 10000);
    return () => clearInterval(interval);
  }, [loadMatch, match]);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTerms() {
      if (!user?.uid) {
        setTermsAccepted(false);
        return;
      }

      try {
        const accepted = await hasAcceptedFanTerms(user.uid);
        if (active) setTermsAccepted(accepted);
      } catch (termsError) {
        console.log("FAN TERMS ERROR:", termsError);
        if (active) setTermsAccepted(false);
      }
    }

    loadTerms();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setBlockedUserIds(new Set());
      return undefined;
    }

    return subscribeToBlockedUsers(
      setBlockedUserIds,
      () => setFanError("Your blocked-user list could not be loaded.")
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !termsAccepted) {
      setMessages([]);
      setPoll({
        counts: { home: 0, draw: 0, away: 0 },
        total: 0,
        userChoice: null,
      });
      return undefined;
    }

    setFanError("");
    const stopMessages = subscribeToFanMessages(
      id,
      setMessages,
      () =>
        setFanError(
          "The fan room is not available until Firestore room permissions are enabled."
        )
    );
    const stopPoll = subscribeToFanPoll(
      id,
      setPoll,
      () =>
        setFanError(
          "The fan room is not available until Firestore room permissions are enabled."
        )
    );

    return () => {
      stopMessages();
      stopPoll();
    };
  }, [id, termsAccepted, user?.uid]);

  useEffect(() => {
    if (!match || !isLiveMatch(match)) {
      pulse.setValue(1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.45,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [match, pulse]);

  async function openOfficialLink(url) {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        throw new Error("This link cannot be opened on this device.");
      }

      await Linking.openURL(url);
    } catch (linkError) {
      Alert.alert("Link unavailable", linkError.message);
    }
  }

  async function setReminder() {
    const reminderId = await scheduleKickoffReminder(match);

    Alert.alert(
      reminderId ? "Reminder set" : "Reminder unavailable",
      reminderId
        ? "You will be notified 15 minutes before kickoff."
        : "Reminders require a real phone, notification permission, and a kickoff more than 15 minutes away."
    );
  }

  async function submitMessage() {
    try {
      setSending(true);
      await sendFanMessage(id, message);
      setMessage("");
    } catch (sendError) {
      Alert.alert("Could not send", sendError.message);
    } finally {
      setSending(false);
    }
  }

  async function submitVote(choice) {
    try {
      await voteInFanPoll(id, choice);
    } catch (voteError) {
      Alert.alert("Could not vote", voteError.message);
    }
  }

  async function acceptCommunityRules() {
    try {
      setTermsLoading(true);
      await acceptFanTerms();
      setTermsAccepted(true);
      setFanError("");
    } catch (termsError) {
      Alert.alert("Could not join", termsError.message);
    } finally {
      setTermsLoading(false);
    }
  }

  function showMessageActions(item) {
    if (!user || item.userId === user.uid) return;

    Alert.alert(
      fanDisplayName(item),
      "Choose how you want to handle this message.",
      [
        {
          text: "Report message",
          onPress: async () => {
            try {
              await reportFanMessage(
                id,
                item,
                "Objectionable content"
              );
              Alert.alert(
                "Report received",
                "The message was sent to MatchZone for review."
              );
            } catch (reportError) {
              Alert.alert("Report failed", reportError.message);
            }
          },
        },
        {
          text: "Block user",
          style: "destructive",
          onPress: async () => {
            try {
              await blockFanUser(item.userId);
              Alert.alert(
                "User blocked",
                "Their Fan Room messages are now hidden for you."
              );
            } catch (blockError) {
              Alert.alert("Block failed", blockError.message);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Opening Watch Room...</Text>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.loader}>
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={theme.danger}
        />
        <Text style={styles.errorTitle}>Watch Room unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadMatch()}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const live = isLiveMatch(match);
  const viewing = getWatchOptions(match.competition?.code, region);
  const media = getOfficialMediaLinks(
    match.competition?.code,
    region
  );
  const companion = getMatchCompanion(match);
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;
  const fanReady = Boolean(user && termsAccepted);
  const visibleMessages = messages.filter(
    (item) => !blockedUserIds.has(String(item.userId))
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>

        <View style={styles.roomIdentity}>
          <Ionicons
            name="football-outline"
            size={17}
            color={theme.accent}
          />
          <Text style={styles.roomIdentityText}>WATCH ROOM</Text>
        </View>

        <Pressable style={styles.circleButton} onPress={setReminder}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={theme.text}
          />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.matchHero}>
          <View style={styles.competitionRow}>
            <CompetitionLogo
              code={match.competition?.code}
              uri={match.competition?.emblem}
              size={30}
              theme={theme}
            />
            <Text style={styles.competitionName}>
              {match.competition?.name}
            </Text>
            <View
              style={[
                styles.statusPill,
                live && styles.liveStatusPill,
              ]}
            >
              {live ? (
                <Animated.View
                  style={[
                    styles.liveDot,
                    {
                      transform: [{ scale: pulse }],
                    },
                  ]}
                />
              ) : null}
              <Text
                style={[
                  styles.statusText,
                  live && styles.liveStatusText,
                ]}
              >
                {statusLabel(match)}
              </Text>
            </View>
          </View>

          <View style={styles.teamsRow}>
            <View style={styles.teamBox}>
              <TeamBadge
                team={match.homeTeam}
                competitionCode={match.competition?.code}
                size={64}
                theme={theme}
              />
              <Text style={styles.teamName} numberOfLines={2}>
                {teamName(match.homeTeam)}
              </Text>
            </View>

            <View style={styles.scoreBox}>
              <Text style={styles.score}>
                {live || match.status === "FINISHED"
                  ? `${homeScore ?? 0} - ${awayScore ?? 0}`
                  : "VS"}
              </Text>
              <Text style={styles.kickoff}>{timeLabel(match.utcDate)}</Text>
            </View>

            <View style={styles.teamBox}>
              <TeamBadge
                team={match.awayTeam}
                competitionCode={match.competition?.code}
                size={64}
                theme={theme}
              />
              <Text style={styles.teamName} numberOfLines={2}>
                {teamName(match.awayTeam)}
              </Text>
            </View>
          </View>

          <View style={styles.tracker}>
            {[
              {
                key: "scheduled",
                label: "Scheduled",
                active: true,
              },
              {
                key: "live",
                label: "Live",
                active: live || match.status === "FINISHED",
              },
              {
                key: "finished",
                label: "Full time",
                active: match.status === "FINISHED",
              },
            ].map((item, index) => (
              <View key={item.key} style={styles.trackerStep}>
                <View
                  style={[
                    styles.trackerNode,
                    item.active && styles.activeTrackerNode,
                    live &&
                      item.key === "live" &&
                      styles.liveTrackerNode,
                  ]}
                />
                <Text
                  style={[
                    styles.trackerStepText,
                    item.active && styles.activeTrackerStepText,
                  ]}
                >
                  {item.label}
                </Text>
                {index < 2 ? (
                  <View
                    style={[
                      styles.trackerLine,
                      item.active &&
                        (index === 0
                          ? live || match.status === "FINISHED"
                          : match.status === "FINISHED") &&
                        styles.activeTrackerLine,
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
          <Text style={styles.trackerText}>
            {match.status === "FINISHED"
              ? "Match complete"
              : live
              ? "Match in progress. Score and events refresh every 10 seconds."
              : "Room open before kickoff"}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.activeTab,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeTab === "watch" ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Where to watch</Text>
              <Text style={styles.sectionTag}>{getRegionName(region)}</Text>
            </View>

            {viewing.options.length ? (
              viewing.options.map((option) => (
                <Pressable
                  key={option.name}
                  style={styles.providerCard}
                  onPress={() => openOfficialLink(option.url)}
                >
                  <View style={styles.providerIcon}>
                    <Ionicons
                      name="open-outline"
                      size={22}
                      color={theme.accent}
                    />
                  </View>
                  <View style={styles.providerCopy}>
                    <Text style={styles.providerName}>{option.name}</Text>
                    <Text style={styles.providerDetail}>{option.detail}</Text>
                    <Text style={styles.providerMeta}>
                      {option.type} | {option.language}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color={theme.subText}
                  />
                </Pressable>
              ))
            ) : (
              <View style={styles.infoCard}>
                <Ionicons
                  name="location-outline"
                  size={24}
                  color={theme.accent}
                />
                <View style={styles.infoCopy}>
                  <Text style={styles.infoTitle}>
                    Viewing details unavailable
                  </Text>
                  <Text style={styles.infoText}>
                    Check the competition guide for current options.
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              style={styles.primaryButton}
              onPress={() => openOfficialLink(viewing.guideUrl)}
            >
              <Ionicons
                name="globe-outline"
                size={19}
                color={theme.onAccent}
              />
              <Text style={styles.primaryButtonText}>
                Open viewing guide
              </Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Match media</Text>
            <AvailabilityCard
              icon="headset-outline"
              title="Live audio commentary"
              text={
                media.audio.length
                  ? "An audio link is available."
                  : "No audio feed is currently available."
              }
              available={media.audio.length > 0}
              styles={styles}
              theme={theme}
            />
            <AvailabilityCard
              icon="videocam-outline"
              title="Highlights and clips"
              text={
                media.highlights.length
                  ? "Match media pages are available."
                  : "No clips are currently available for this competition."
              }
              available={media.highlights.length > 0}
              styles={styles}
              theme={theme}
            />

            {media.highlights.map((item) => (
              <Pressable
                key={item.name}
                style={styles.mediaLink}
                onPress={() => openOfficialLink(item.url)}
              >
                <Text style={styles.mediaLinkText}>{item.name}</Text>
                <Ionicons
                  name="open-outline"
                  size={17}
                  color={theme.accent}
                />
              </Pressable>
            ))}

            <Pressable
              style={styles.matchDetailsButton}
              onPress={() =>
                router.push({
                  pathname: "/match/[id]",
                  params: { id: match.id },
                })
              }
            >
              <Text style={styles.matchDetailsText}>
                Open full match details
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={theme.text}
              />
            </Pressable>
          </>
        ) : null}

        {activeTab === "companion" ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Match companion</Text>
              <Text style={styles.sectionTag}>REAL DATA</Text>
            </View>
            <Text style={styles.sectionSub}>
              Explains verified context only. It will not invent tactics or
              events that the provider has not returned.
            </Text>

            <View style={styles.companionCard}>
              <View style={styles.companionHeader}>
                <Ionicons
                  name="analytics-outline"
                  size={24}
                  color={theme.accent}
                />
                <Text style={styles.companionTitle}>What is happening</Text>
              </View>

              {companion.facts.map((fact) => (
                <View key={fact} style={styles.factRow}>
                  <View style={styles.factDot} />
                  <Text style={styles.factText}>{fact}</Text>
                </View>
              ))}
            </View>

            <View style={styles.guardrailCard}>
              <Ionicons
                name="shield-outline"
                size={23}
                color={theme.gold}
              />
              <View style={styles.guardrailCopy}>
                <Text style={styles.guardrailTitle}>
                  Tactical analysis status
                </Text>
                <Text style={styles.guardrailText}>
                  {companion.tacticalStatus}
                </Text>
              </View>
            </View>

            <View style={styles.dataGrid}>
              <View style={styles.dataCell}>
                <Text style={styles.dataValue}>
                  {match.group?.replaceAll("_", " ") || "-"}
                </Text>
                <Text style={styles.dataLabel}>Group</Text>
              </View>
              <View style={styles.dataCell}>
                <Text style={styles.dataValue}>
                  {match.matchday || "-"}
                </Text>
                <Text style={styles.dataLabel}>Matchday</Text>
              </View>
              <View style={styles.dataCell}>
                <Text style={styles.dataValue}>
                  {match.referees?.[0]?.name || "-"}
                </Text>
                <Text style={styles.dataLabel}>Referee</Text>
              </View>
            </View>
          </>
        ) : null}

        {activeTab === "fans" ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Fan room</Text>
              <Text style={styles.sectionTag}>
                {user ? "SIGNED IN" : "READ ONLY"}
              </Text>
            </View>
            <Text style={styles.sectionSub}>
              Sign in and accept the community rules to view or participate.
              Messages can be reported and users can be blocked.
            </Text>

            {!user ? (
              <View style={styles.fanAccessCard}>
                <Ionicons
                  name="lock-closed-outline"
                  size={25}
                  color={theme.accent}
                />
                <View style={styles.fanAccessCopy}>
                  <Text style={styles.fanAccessTitle}>
                    Sign in required
                  </Text>
                  <Text style={styles.fanAccessText}>
                    Fan Room content is available only to signed-in users.
                  </Text>
                </View>
                <Pressable
                  style={styles.smallAction}
                  onPress={() => router.push("/profile")}
                >
                  <Text style={styles.smallActionText}>Profile</Text>
                </Pressable>
              </View>
            ) : !termsAccepted ? (
              <View style={styles.termsCard}>
                <Ionicons
                  name="people-circle-outline"
                  size={30}
                  color={theme.accent}
                />
                <Text style={styles.termsTitle}>
                  Join the Fan Room safely
                </Text>
                <Text style={styles.termsText}>
                  Be respectful. No harassment, hate, threats, sexual
                  content, scams, spam or private information. Reports are
                  reviewed and abusive accounts may be restricted.
                </Text>
                <View style={styles.termsLinks}>
                  <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
                    <Text style={styles.termsLink}>Community rules</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
                    <Text style={styles.termsLink}>Privacy policy</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.acceptTermsButton}
                  onPress={acceptCommunityRules}
                  disabled={termsLoading}
                >
                  {termsLoading ? (
                    <ActivityIndicator color={theme.onAccent} />
                  ) : (
                    <Text style={styles.acceptTermsText}>
                      Accept Rules and Join
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            <View style={styles.pollCard}>
              <Text style={styles.pollTitle}>Who gets the result?</Text>
              <Text style={styles.pollMeta}>
                {poll.total} verified {poll.total === 1 ? "vote" : "votes"}
              </Text>

              {[
                ["home", teamName(match.homeTeam)],
                ["draw", "Draw"],
                ["away", teamName(match.awayTeam)],
              ].map(([choice, label]) => {
                const count = poll.counts[choice] || 0;
                const percent = poll.total
                  ? Math.round((count / poll.total) * 100)
                  : 0;

                return (
                  <Pressable
                    key={choice}
                    style={[
                      styles.pollOption,
                      poll.userChoice === choice && styles.selectedPoll,
                    ]}
                    onPress={() => submitVote(choice)}
                    disabled={!fanReady}
                  >
                    <View style={styles.pollLabelRow}>
                      <Text style={styles.pollLabel}>{label}</Text>
                      <Text style={styles.pollPercent}>{percent}%</Text>
                    </View>
                    <View style={styles.pollTrack}>
                      <View
                        style={[
                          styles.pollFill,
                          { width: `${percent}%` },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>Live chat</Text>
                <Text style={styles.chatCount}>
                  {visibleMessages.length} recent
                </Text>
              </View>

              {fanError ? (
                <Text style={styles.fanError}>{fanError}</Text>
              ) : !fanReady ? (
                <Text style={styles.emptyChat}>
                  Sign in and accept the community rules to open this room.
                </Text>
              ) : visibleMessages.length === 0 ? (
                <Text style={styles.emptyChat}>
                  No messages yet. The room starts with its first real fan.
                </Text>
              ) : (
                visibleMessages.map((item) => (
                  <View key={item.id} style={styles.messageRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {fanDisplayName(item)
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.messageBubble}>
                      <View style={styles.messageMeta}>
                        <Text style={styles.messageAuthor}>
                          {fanDisplayName(item)}
                        </Text>
                        <Text style={styles.messageTime}>
                          {messageTime(item.createdAt)}
                        </Text>
                      </View>
                      <Text style={styles.messageText}>{item.text}</Text>
                    </View>
                    {item.userId !== user?.uid ? (
                      <Pressable
                        style={styles.messageAction}
                        onPress={() => showMessageActions(item)}
                        accessibilityLabel="Report or block this user"
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color={theme.subText}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}

              <View style={styles.composer}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  style={styles.input}
                  placeholder={
                    fanReady
                      ? "Share a match thought..."
                      : "Accept the rules to join"
                  }
                  placeholderTextColor={theme.subText}
                  editable={fanReady && !sending}
                  maxLength={240}
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    (!fanReady || !message.trim()) && styles.disabledSend,
                  ]}
                  onPress={submitMessage}
                  disabled={!fanReady || !message.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.onAccent}
                    />
                  ) : (
                    <Ionicons
                      name="send"
                      size={18}
                      color={theme.onAccent}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 50,
      paddingHorizontal: 14,
    },
    loader: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 30,
    },
    loadingText: {
      color: theme.subText,
      marginTop: 13,
    },
    errorTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: "900",
      marginTop: 14,
    },
    errorText: {
      color: theme.subText,
      textAlign: "center",
      marginTop: 8,
    },
    retryButton: {
      backgroundColor: theme.accent,
      borderRadius: 15,
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginTop: 16,
    },
    retryText: {
      color: theme.onAccent,
      fontWeight: "900",
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    circleButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    roomIdentity: {
      flexDirection: "row",
      alignItems: "center",
    },
    roomIdentityText: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      marginLeft: 6,
    },
    matchHero: {
      backgroundColor: theme.card,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 17,
      marginBottom: 15,
    },
    competitionRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    competitionName: {
      color: theme.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
      marginLeft: 9,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardAlt,
      borderRadius: 13,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    liveStatusPill: {
      backgroundColor: "rgba(255,59,48,0.12)",
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.danger,
      marginRight: 6,
    },
    statusText: {
      color: theme.subText,
      fontSize: 9,
      fontWeight: "900",
    },
    liveStatusText: {
      color: theme.danger,
    },
    teamsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 23,
    },
    teamBox: {
      width: "35%",
      alignItems: "center",
    },
    teamName: {
      color: theme.text,
      textAlign: "center",
      fontWeight: "800",
      fontSize: 13,
      marginTop: 9,
    },
    scoreBox: {
      flex: 1,
      alignItems: "center",
    },
    score: {
      color: theme.text,
      fontSize: 27,
      fontWeight: "900",
    },
    kickoff: {
      color: theme.subText,
      fontSize: 9,
      textAlign: "center",
      lineHeight: 14,
      marginTop: 5,
    },
    tracker: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 22,
    },
    trackerStep: {
      flex: 1,
      alignItems: "center",
      position: "relative",
    },
    trackerNode: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.border,
      zIndex: 2,
    },
    activeTrackerNode: {
      backgroundColor: theme.accent,
    },
    liveTrackerNode: {
      backgroundColor: theme.danger,
    },
    trackerLine: {
      position: "absolute",
      height: 2,
      width: "100%",
      left: "50%",
      top: 4,
      backgroundColor: theme.border,
      zIndex: 1,
    },
    activeTrackerLine: {
      backgroundColor: theme.accent,
    },
    trackerStepText: {
      color: theme.subText,
      fontSize: 8,
      marginTop: 5,
    },
    activeTrackerStepText: {
      color: theme.text,
      fontWeight: "700",
    },
    trackerText: {
      color: theme.subText,
      fontSize: 9,
      textAlign: "center",
      marginTop: 8,
    },
    tabs: {
      paddingBottom: 19,
    },
    tabButton: {
      borderRadius: 17,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 19,
      paddingVertical: 10,
      marginRight: 9,
    },
    activeTab: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    tabText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
    },
    activeTabText: {
      color: theme.onAccent,
      fontWeight: "900",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
      marginBottom: 6,
      marginTop: 3,
    },
    sectionTag: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      backgroundColor: theme.cardAlt,
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 6,
      overflow: "hidden",
    },
    sectionSub: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 17,
      marginBottom: 14,
    },
    providerCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    providerIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor: theme.cardAlt,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    providerCopy: {
      flex: 1,
      marginRight: 8,
    },
    providerName: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 14,
    },
    providerDetail: {
      color: theme.subText,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 4,
    },
    providerMeta: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "700",
      marginTop: 5,
    },
    infoCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 15,
      marginBottom: 12,
    },
    infoCopy: {
      flex: 1,
      marginLeft: 11,
    },
    infoTitle: {
      color: theme.text,
      fontWeight: "800",
    },
    infoText: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 4,
    },
    primaryButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.accent,
      borderRadius: 17,
      paddingVertical: 12,
      marginTop: 2,
    },
    primaryButtonText: {
      color: theme.onAccent,
      fontWeight: "900",
      marginLeft: 7,
    },
    availabilityCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 13,
      marginBottom: 9,
    },
    availabilityIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: theme.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 11,
    },
    availabilityCopy: {
      flex: 1,
      marginRight: 8,
    },
    availabilityTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 13,
    },
    availabilityText: {
      color: theme.subText,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    mediaLink: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    mediaLinkText: {
      color: theme.accent,
      fontWeight: "700",
      fontSize: 12,
    },
    matchDetailsButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.cardAlt,
      borderRadius: 17,
      padding: 14,
      marginTop: 18,
      marginBottom: 16,
    },
    matchDetailsText: {
      color: theme.text,
      fontWeight: "800",
    },
    companionCard: {
      backgroundColor: theme.card,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 12,
    },
    companionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 13,
    },
    companionTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 16,
      marginLeft: 9,
    },
    factRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 9,
    },
    factDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.accent,
      marginTop: 6,
      marginRight: 9,
    },
    factText: {
      color: theme.subText,
      flex: 1,
      fontSize: 12,
      lineHeight: 19,
    },
    guardrailCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.cardAlt,
      borderRadius: 19,
      padding: 15,
      marginBottom: 13,
    },
    guardrailCopy: {
      flex: 1,
      marginLeft: 11,
    },
    guardrailTitle: {
      color: theme.text,
      fontWeight: "800",
    },
    guardrailText: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 4,
    },
    dataGrid: {
      flexDirection: "row",
      backgroundColor: theme.card,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 15,
    },
    dataCell: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 4,
    },
    dataValue: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 11,
      textAlign: "center",
    },
    dataLabel: {
      color: theme.subText,
      fontSize: 9,
      marginTop: 4,
    },
    pollCard: {
      backgroundColor: theme.card,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 13,
    },
    pollTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 16,
    },
    pollMeta: {
      color: theme.subText,
      fontSize: 10,
      marginTop: 3,
      marginBottom: 11,
    },
    pollOption: {
      backgroundColor: theme.cardAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "transparent",
      padding: 11,
      marginTop: 8,
    },
    selectedPoll: {
      borderColor: theme.accent,
    },
    pollLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    pollLabel: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 12,
    },
    pollPercent: {
      color: theme.accent,
      fontWeight: "900",
      fontSize: 12,
    },
    pollTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      overflow: "hidden",
      marginTop: 8,
    },
    pollFill: {
      height: "100%",
      backgroundColor: theme.accent,
    },
    chatCard: {
      backgroundColor: theme.card,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 15,
    },
    chatHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    chatTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },
    chatCount: {
      color: theme.subText,
      fontSize: 10,
    },
    fanError: {
      color: theme.danger,
      fontSize: 11,
      lineHeight: 17,
      marginBottom: 12,
    },
    fanAccessCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 13,
    },
    fanAccessCopy: {
      flex: 1,
      marginHorizontal: 11,
    },
    fanAccessTitle: {
      color: theme.text,
      fontWeight: "900",
    },
    fanAccessText: {
      color: theme.subText,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    smallAction: {
      backgroundColor: theme.accent,
      borderRadius: 13,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    smallActionText: {
      color: theme.onAccent,
      fontSize: 11,
      fontWeight: "900",
    },
    termsCard: {
      backgroundColor: theme.card,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: theme.accent,
      padding: 17,
      marginBottom: 13,
    },
    termsTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "900",
      marginTop: 10,
    },
    termsText: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 7,
    },
    termsLinks: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 13,
    },
    termsLink: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
    },
    acceptTermsButton: {
      backgroundColor: theme.accent,
      minHeight: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 15,
    },
    acceptTermsText: {
      color: theme.onAccent,
      fontWeight: "900",
    },
    emptyChat: {
      color: theme.subText,
      textAlign: "center",
      fontSize: 11,
      lineHeight: 17,
      paddingVertical: 20,
    },
    messageRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    avatar: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor: theme.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 9,
    },
    avatarText: {
      color: theme.accent,
      fontWeight: "900",
    },
    messageBubble: {
      flex: 1,
    },
    messageAction: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 4,
    },
    messageMeta: {
      flexDirection: "row",
      alignItems: "center",
    },
    messageAuthor: {
      color: theme.text,
      fontSize: 11,
      fontWeight: "800",
    },
    messageTime: {
      color: theme.subText,
      fontSize: 8,
      marginLeft: 7,
    },
    messageText: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 3,
    },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
      marginTop: 4,
    },
    input: {
      flex: 1,
      minHeight: 43,
      backgroundColor: theme.cardAlt,
      color: theme.text,
      borderRadius: 16,
      paddingHorizontal: 13,
      fontSize: 12,
    },
    sendButton: {
      width: 43,
      height: 43,
      borderRadius: 16,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    disabledSend: {
      opacity: 0.4,
    },
    bottomSpace: {
      height: 50,
    },
  });
}

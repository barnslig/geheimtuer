import jwt from "jsonwebtoken";
import * as IRC from "irc-framework";
import "dotenv/config";

const REQUIRED_FLAGS = /[Oiov]/;

const bot = new IRC.Client();

bot.connect({
  host: process.env.IRC_HOST,
  port: 6697,
  nick: process.env.IRC_NICK,
  tls: true,
});

bot.on("registered", function () {
  bot.say("NickServ", `identify ${process.env.NICKSERV_PASSWORD}`);
});

bot.on("message", async function (event) {
  // console.log(event);

  // Auto-Register @ NickServ
  if (
    (event.type === "notice" &&
      event.nick === "NickServ" &&
      / is not a registered nickname.$/.test(event.message)) ||
    event.message ===
      "You can not register your nick so soon after connecting. Please wait a while and try again."
  ) {
    setTimeout(() => {
      event.reply(
        `register ${process.env.NICKSERV_PASSWORD} ${process.env.NICKSERV_EMAIL}`
      );
    }, 60 * 1000);
  }

  // Eventually positive ChanServ FLAGS response
  if (
    event.type === "notice" &&
    event.nick === "ChanServ" &&
    /^Flags for /.test(event.message)
  ) {
    const [, nick, , flags] = event.message.match(
      /^Flags for \x02(.+)\x02 in \x02(.+)\x02 are \x02\+(.+)\x02.$/
    );

    const isAllowed = REQUIRED_FLAGS.test(flags);

    if (isAllowed) {
      const token = jwt.sign(
        {
          nick,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "5m",
        }
      );
      bot.say(
        nick,
        `Hier gehts lang: https://wiki.geheimorganisation.org/auth?token=${token}`
      );
    } else {
      bot.say(nick, "Heute leider nicht.");
    }
  }

  // Most probably negative ChanServ response
  if (
    event.type === "notice" &&
    event.nick === "ChanServ" &&
    /is not registered./.test(event.message)
  ) {
    const [, nick] = event.message.match(/^\x02(.+)\x02 is not registered./);
    bot.say(nick, "Heute leider nicht.");
  }

  // React to any private message with a flags check
  if (event.type === "privmsg") {
    bot.whois(event.nick, (res) => {
      if (res.secure && res.account) {
        bot.say("ChanServ", `FLAGS #geheimorganisation ${event.nick}`);
      } else {
        event.reply("Sorry, ohne NickServ-Login lass ich dich nicht rein.");
      }
    });
  }
});
